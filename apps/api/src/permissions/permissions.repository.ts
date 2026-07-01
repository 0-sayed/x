import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { PermissionKey } from '@materiabill/contracts';
import type { DatabaseClient } from '@materiabill/db';
import {
  rolePermissions,
  userRoleAssignments,
  workspaceMembershipRefs,
  workspaceRoles,
} from '@materiabill/db';
import { defaultRoleTemplates, type DefaultRoleTemplateKey } from '@materiabill/permissions';
import { and, countDistinct, eq, inArray, isNull, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';

type Db = DatabaseClient['db'];

type SeedWorkspaceInput = {
  readonly workspaceId: string;
  readonly membershipUserId: string | null;
  readonly isAdmin: boolean;
};

type ReplaceAssignmentsInput = {
  readonly workspaceId: string;
  readonly userId: string;
  readonly roleIds: readonly string[];
};

type CreateRoleInput = {
  readonly workspaceId: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly permissions: readonly PermissionKey[];
};

type UpdateRoleInput = {
  readonly workspaceId: string;
  readonly roleId: string;
  readonly nameEn?: string;
  readonly nameAr?: string;
  readonly permissions?: readonly PermissionKey[];
};

type CloneRoleInput = {
  readonly workspaceId: string;
  readonly sourceRoleId: string;
  readonly nameEn: string;
  readonly nameAr: string;
};

type WorkspaceRoleSummary = {
  readonly id: string;
  readonly workspaceId: string;
  readonly systemKey: DefaultRoleTemplateKey | null;
  readonly isSystem: boolean;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly permissions: PermissionKey[];
  readonly clonedFromRoleId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const systemRoleUpsertTarget = [workspaceRoles.workspaceId, workspaceRoles.systemKey];

const systemRoleUpsertTargetWhere = sql`${workspaceRoles.systemKey} IS NOT NULL AND ${workspaceRoles.isSystem} = true AND ${workspaceRoles.deletedAt} IS NULL`;
const externalAdminAssignmentSource = 'inframodern_admin';
const manualAssignmentSource = 'manual';

@Injectable()
export class PermissionsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async seedWorkspaceSystemRoles(input: SeedWorkspaceInput, db: Db = this.#db): Promise<void> {
    const seed = async (tx: Db): Promise<void> => {
      let assignmentRoleId: string | null = null;
      let externalAdminRoleId: string | null = null;
      const assignmentSystemKey: DefaultRoleTemplateKey = input.isAdmin
        ? 'workspaceAdmin'
        : 'viewer';

      for (const template of Object.values(defaultRoleTemplates)) {
        const rows = await tx
          .insert(workspaceRoles)
          .values({
            workspaceId: input.workspaceId,
            systemKey: template.key,
            isSystem: true,
            nameEn: template.nameEn,
            nameAr: template.nameAr,
          })
          .onConflictDoUpdate({
            target: systemRoleUpsertTarget,
            targetWhere: systemRoleUpsertTargetWhere,
            set: {
              nameEn: template.nameEn,
              nameAr: template.nameAr,
              updatedAt: new Date(),
              deletedAt: null,
            },
          })
          .returning({ id: workspaceRoles.id });

        const roleId = rows[0]?.id;
        if (!roleId) {
          continue;
        }

        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
        await tx.insert(rolePermissions).values(
          template.permissions.map((permissionKey) => ({
            workspaceId: input.workspaceId,
            roleId,
            permissionKey,
          })),
        );

        if (template.key === 'workspaceAdmin') {
          externalAdminRoleId = roleId;
        }

        if (template.key === assignmentSystemKey) {
          assignmentRoleId = roleId;
        }
      }

      if (input.membershipUserId && assignmentRoleId) {
        if (!input.isAdmin && externalAdminRoleId) {
          await tx
            .delete(userRoleAssignments)
            .where(
              and(
                eq(userRoleAssignments.workspaceId, input.workspaceId),
                eq(userRoleAssignments.userId, input.membershipUserId),
                eq(userRoleAssignments.roleId, externalAdminRoleId),
                eq(userRoleAssignments.source, externalAdminAssignmentSource),
              ),
            );
        }

        const existingAssignments = await tx
          .select({ count: countDistinct(userRoleAssignments.roleId) })
          .from(userRoleAssignments)
          .where(
            and(
              eq(userRoleAssignments.workspaceId, input.workspaceId),
              eq(userRoleAssignments.userId, input.membershipUserId),
            ),
          );

        if (input.isAdmin || (existingAssignments[0]?.count ?? 0) === 0) {
          await tx
            .insert(userRoleAssignments)
            .values({
              workspaceId: input.workspaceId,
              userId: input.membershipUserId,
              roleId: assignmentRoleId,
              source: input.isAdmin ? externalAdminAssignmentSource : manualAssignmentSource,
            })
            .onConflictDoNothing();
        }
      }
    };

    if ('transaction' in db) {
      await db.transaction(seed);
      return;
    }

    await seed(db);
  }

  async replaceUserRoleAssignments(input: ReplaceAssignmentsInput): Promise<void> {
    await this.#db.transaction(async (tx) => {
      await this.assertActiveWorkspaceMember(input.workspaceId, input.userId, tx);
      await this.assertRoleIdsBelongToWorkspace(input.workspaceId, input.roleIds, tx);

      await tx
        .delete(userRoleAssignments)
        .where(
          and(
            eq(userRoleAssignments.workspaceId, input.workspaceId),
            eq(userRoleAssignments.userId, input.userId),
            eq(userRoleAssignments.source, manualAssignmentSource),
          ),
        );

      if (input.roleIds.length > 0) {
        await tx.insert(userRoleAssignments).values(
          input.roleIds.map((roleId) => ({
            workspaceId: input.workspaceId,
            userId: input.userId,
            roleId,
            source: manualAssignmentSource,
          })),
        );
      }

      await this.assertWorkspaceKeepsManageRoles(input.workspaceId, tx);
    });
  }

  async createRole(input: CreateRoleInput): Promise<WorkspaceRoleSummary> {
    return this.#db.transaction(async (tx) => {
      const rows = await tx
        .insert(workspaceRoles)
        .values({
          workspaceId: input.workspaceId,
          systemKey: null,
          isSystem: false,
          nameEn: input.nameEn,
          nameAr: input.nameAr,
        })
        .returning({ id: workspaceRoles.id });

      const roleId = rows[0]?.id;
      if (!roleId) {
        throw new Error('Failed to create role');
      }

      await tx.insert(rolePermissions).values(
        input.permissions.map((permissionKey) => ({
          workspaceId: input.workspaceId,
          roleId,
          permissionKey,
        })),
      );

      const role = await this.findRoleSummary(input.workspaceId, roleId, tx);
      if (!role) {
        throw new Error('Failed to read created role');
      }

      return role;
    });
  }

  async updateRole(input: UpdateRoleInput): Promise<WorkspaceRoleSummary | null> {
    return this.#db.transaction(async (tx) => {
      const existingRole = await this.findRoleSummary(input.workspaceId, input.roleId, tx);
      if (!existingRole) {
        return null;
      }

      if (existingRole.isSystem) {
        throw new ForbiddenException('System roles cannot be edited directly');
      }

      if (input.nameEn !== undefined || input.nameAr !== undefined) {
        await tx
          .update(workspaceRoles)
          .set({
            ...(input.nameEn === undefined ? {} : { nameEn: input.nameEn }),
            ...(input.nameAr === undefined ? {} : { nameAr: input.nameAr }),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workspaceRoles.workspaceId, input.workspaceId),
              eq(workspaceRoles.id, input.roleId),
              isNull(workspaceRoles.deletedAt),
            ),
          );
      }

      if (input.permissions !== undefined) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, input.roleId));
        await tx.insert(rolePermissions).values(
          input.permissions.map((permissionKey) => ({
            workspaceId: input.workspaceId,
            roleId: input.roleId,
            permissionKey,
          })),
        );
        await tx
          .update(workspaceRoles)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(workspaceRoles.workspaceId, input.workspaceId),
              eq(workspaceRoles.id, input.roleId),
              isNull(workspaceRoles.deletedAt),
            ),
          );
        await this.assertWorkspaceKeepsManageRoles(input.workspaceId, tx);
      }

      return this.findRoleSummary(input.workspaceId, input.roleId, tx);
    });
  }

  async cloneRole(input: CloneRoleInput): Promise<WorkspaceRoleSummary | null> {
    return this.#db.transaction(async (tx) => {
      const sourceRole = await this.findRoleSummary(input.workspaceId, input.sourceRoleId, tx);
      if (!sourceRole) {
        return null;
      }

      const rows = await tx
        .insert(workspaceRoles)
        .values({
          workspaceId: input.workspaceId,
          systemKey: null,
          isSystem: false,
          nameEn: input.nameEn,
          nameAr: input.nameAr,
          clonedFromRoleId: input.sourceRoleId,
        })
        .returning({ id: workspaceRoles.id });

      const roleId = rows[0]?.id;
      if (!roleId) {
        throw new Error('Failed to clone role');
      }

      await tx.insert(rolePermissions).values(
        sourceRole.permissions.map((permissionKey) => ({
          workspaceId: input.workspaceId,
          roleId,
          permissionKey,
        })),
      );

      const role = await this.findRoleSummary(input.workspaceId, roleId, tx);
      if (!role) {
        throw new Error('Failed to read cloned role');
      }

      return role;
    });
  }

  async findRoleSummary(
    workspaceId: string,
    roleId: string,
    db: Db = this.#db,
  ): Promise<WorkspaceRoleSummary | null> {
    const roles = await this.findWorkspaceRoles(workspaceId, db);

    return roles.find((role) => role.id === roleId) ?? null;
  }

  async findWorkspaceRoles(
    workspaceId: string,
    db: Db = this.#db,
  ): Promise<readonly WorkspaceRoleSummary[]> {
    const rows = await db
      .select({
        id: workspaceRoles.id,
        workspaceId: workspaceRoles.workspaceId,
        systemKey: workspaceRoles.systemKey,
        isSystem: workspaceRoles.isSystem,
        nameEn: workspaceRoles.nameEn,
        nameAr: workspaceRoles.nameAr,
        clonedFromRoleId: workspaceRoles.clonedFromRoleId,
        createdAt: workspaceRoles.createdAt,
        updatedAt: workspaceRoles.updatedAt,
        permissionKey: rolePermissions.permissionKey,
      })
      .from(workspaceRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, workspaceRoles.id))
      .where(and(eq(workspaceRoles.workspaceId, workspaceId), isNull(workspaceRoles.deletedAt)));

    const roles = new Map<string, WorkspaceRoleSummary>();
    for (const row of rows) {
      const existing = roles.get(row.id);
      if (existing) {
        existing.permissions.push(row.permissionKey as PermissionKey);
        continue;
      }

      roles.set(row.id, {
        id: row.id,
        workspaceId: row.workspaceId,
        systemKey: row.systemKey as DefaultRoleTemplateKey | null,
        isSystem: row.isSystem,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        permissions: [row.permissionKey as PermissionKey],
        clonedFromRoleId: row.clonedFromRoleId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    }

    return [...roles.values()].map((role) => ({
      ...role,
      permissions: [...new Set(role.permissions)].sort(),
    }));
  }

  async findEffectivePermissions(
    workspaceId: string,
    userId: string,
    db: Db = this.#db,
  ): Promise<readonly PermissionKey[]> {
    const rows = await db
      .select({ permissionKey: rolePermissions.permissionKey })
      .from(userRoleAssignments)
      .innerJoin(workspaceRoles, eq(workspaceRoles.id, userRoleAssignments.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, workspaceRoles.id))
      .where(
        and(
          eq(userRoleAssignments.workspaceId, workspaceId),
          eq(userRoleAssignments.userId, userId),
          eq(workspaceRoles.workspaceId, workspaceId),
          eq(rolePermissions.workspaceId, workspaceId),
          isNull(workspaceRoles.deletedAt),
        ),
      );

    return [...new Set(rows.map((row) => row.permissionKey as PermissionKey))].sort();
  }

  async findEffectivePermissionsByWorkspaceIds(
    workspaceIds: readonly string[],
    userId: string,
    db: Db = this.#db,
  ): Promise<ReadonlyMap<string, readonly PermissionKey[]>> {
    const uniqueWorkspaceIds = [...new Set(workspaceIds)];
    const permissionsByWorkspaceId = new Map<string, PermissionKey[]>(
      uniqueWorkspaceIds.map((workspaceId) => [workspaceId, []]),
    );

    if (uniqueWorkspaceIds.length === 0) {
      return permissionsByWorkspaceId;
    }

    const rows = await db
      .select({
        workspaceId: userRoleAssignments.workspaceId,
        permissionKey: rolePermissions.permissionKey,
      })
      .from(userRoleAssignments)
      .innerJoin(
        workspaceRoles,
        and(
          eq(workspaceRoles.id, userRoleAssignments.roleId),
          eq(workspaceRoles.workspaceId, userRoleAssignments.workspaceId),
        ),
      )
      .innerJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleId, workspaceRoles.id),
          eq(rolePermissions.workspaceId, userRoleAssignments.workspaceId),
        ),
      )
      .where(
        and(
          inArray(userRoleAssignments.workspaceId, uniqueWorkspaceIds),
          eq(userRoleAssignments.userId, userId),
          isNull(workspaceRoles.deletedAt),
        ),
      );

    for (const row of rows) {
      permissionsByWorkspaceId.get(row.workspaceId)?.push(row.permissionKey as PermissionKey);
    }

    return new Map(
      [...permissionsByWorkspaceId.entries()].map(([workspaceId, permissions]) => [
        workspaceId,
        [...new Set(permissions)].sort(),
      ]),
    );
  }

  async assertWorkspaceKeepsManageRoles(workspaceId: string, db: Db = this.#db): Promise<void> {
    const rows = await db
      .select({ count: countDistinct(userRoleAssignments.userId) })
      .from(userRoleAssignments)
      .innerJoin(workspaceRoles, eq(workspaceRoles.id, userRoleAssignments.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, workspaceRoles.id))
      .innerJoin(
        workspaceMembershipRefs,
        and(
          eq(workspaceMembershipRefs.workspaceId, userRoleAssignments.workspaceId),
          eq(workspaceMembershipRefs.userId, userRoleAssignments.userId),
        ),
      )
      .where(
        and(
          eq(userRoleAssignments.workspaceId, workspaceId),
          eq(rolePermissions.permissionKey, 'manage_roles'),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
          isNull(workspaceRoles.deletedAt),
        ),
      );

    if ((rows[0]?.count ?? 0) < 1) {
      throw new ConflictException('At least one workspace member must keep manage_roles');
    }
  }

  async assertRoleIdsBelongToWorkspace(
    workspaceId: string,
    roleIds: readonly string[],
    db: Db = this.#db,
  ): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) {
      throw new BadRequestException('At least one role assignment is required');
    }

    const rows = await db
      .select({ id: workspaceRoles.id })
      .from(workspaceRoles)
      .where(
        and(
          eq(workspaceRoles.workspaceId, workspaceId),
          inArray(workspaceRoles.id, uniqueRoleIds),
          isNull(workspaceRoles.deletedAt),
        ),
      );

    if (rows.length !== uniqueRoleIds.length) {
      throw new BadRequestException('Role assignments must belong to the workspace');
    }
  }

  async assertActiveWorkspaceMember(
    workspaceId: string,
    userId: string,
    db: Db = this.#db,
  ): Promise<void> {
    const rows = await db
      .select({ userId: workspaceMembershipRefs.userId })
      .from(workspaceMembershipRefs)
      .where(
        and(
          eq(workspaceMembershipRefs.workspaceId, workspaceId),
          eq(workspaceMembershipRefs.userId, userId),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
        ),
      );

    if (!rows[0]) {
      throw new BadRequestException('User must be an active workspace member');
    }
  }
}
