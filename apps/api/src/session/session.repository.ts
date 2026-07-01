import { Inject, Injectable } from '@nestjs/common';
import type { CurrentSessionUser, SessionWorkspace } from '@materiabill/contracts';
import type { DatabaseClient } from '@materiabill/db';
import {
  inframodernUserRefs,
  seedWorkspaceSettingsDefaults,
  sessionRecords,
  workspaceMembershipRefs,
  workspaceRefs,
} from '@materiabill/db';
import { and, eq, gt, isNull, notInArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { DATABASE_CLIENT } from '../database/database.module.js';
import { PermissionsRepository } from '../permissions/permissions.repository.js';
import type { InframodernOAuthUser } from './session.types.js';

type Db = DatabaseClient['db'];
type BootstrapDb = Pick<Db, 'insert' | 'update'>;

type CreateSessionInput = {
  readonly userId: string;
  readonly activeWorkspaceId: string | null;
  readonly encryptedTokens: string;
  readonly accessTokenExpiresAt: Date | null;
  readonly refreshTokenExpiresAt: Date | null;
  readonly expiresAt: Date;
};

type UpdateTokensInput = {
  readonly encryptedTokens: string;
  readonly accessTokenExpiresAt: Date | null;
  readonly refreshTokenExpiresAt: Date | null;
};

type LiveSessionResult = {
  readonly user: CurrentSessionUser;
  readonly encryptedTokens: string;
};

type BootstrapWorkspaceProjection = SessionWorkspace;

export class SessionRepository {
  constructor(
    private readonly db: Db,
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  async bootstrapFromInframodern(user: InframodernOAuthUser): Promise<string | null> {
    return this.db.transaction((tx) => this.#bootstrapFromInframodern(tx, user));
  }

  async #bootstrapFromInframodern(
    db: BootstrapDb,
    user: InframodernOAuthUser,
  ): Promise<string | null> {
    const now = new Date();
    const displayName = user.displayName ?? user.name ?? user.email;

    await db
      .insert(inframodernUserRefs)
      .values({
        id: user.id,
        email: user.email,
        displayName,
        phone: user.phone ?? null,
        avatarUrl: user.avatarUrl ?? null,
        locale: user.locale ?? null,
        rawPayload: { ...user },
        syncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: inframodernUserRefs.id,
        set: {
          email: user.email,
          displayName,
          phone: user.phone ?? null,
          avatarUrl: user.avatarUrl ?? null,
          locale: user.locale ?? null,
          rawPayload: { ...user },
          syncedAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      });

    const workspaces = this.#collectBootstrapWorkspaces(user);
    await this.#deactivateOmittedMemberships(
      db,
      user.id,
      workspaces.map((workspace) => workspace.id),
      now,
    );

    if (workspaces.length === 0) {
      return null;
    }

    await db
      .insert(workspaceRefs)
      .values(
        workspaces.map((workspace) => ({
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          rawPayload: workspace,
          syncedAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: workspaceRefs.id,
        set: {
          name: sql`excluded.name`,
          slug: sql`excluded.slug`,
          rawPayload: sql`excluded.raw_payload`,
          syncedAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      });

    for (const workspace of workspaces) {
      await db
        .insert(workspaceMembershipRefs)
        .values({
          workspaceId: workspace.id,
          userId: user.id,
          roleKey: workspace.roleKey,
          permissions: workspace.permissions,
          isAdmin: workspace.isAdmin,
          isActive: true,
          rawPayload: workspace,
          syncedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
          set: {
            roleKey: workspace.roleKey,
            permissions: workspace.permissions,
            isAdmin: workspace.isAdmin,
            isActive: true,
            rawPayload: workspace,
            syncedAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        });

      await this.permissionsRepository.seedWorkspaceSystemRoles(
        {
          workspaceId: workspace.id,
          membershipUserId: user.id,
          isAdmin: workspace.isAdmin,
        },
        db as Db,
      );
      await seedWorkspaceSettingsDefaults(db, [workspace.id]);
    }

    return workspaces[0]?.id ?? null;
  }

  async createSession(input: CreateSessionInput): Promise<string> {
    const id = randomUUID();

    await this.db.insert(sessionRecords).values({
      id,
      ...input,
    });

    return id;
  }

  async findCurrentUserBySessionId(
    sessionId: string,
    now = new Date(),
  ): Promise<LiveSessionResult | null> {
    const rows = await this.db
      .select({
        encryptedTokens: sessionRecords.encryptedTokens,
        activeWorkspaceId: sessionRecords.activeWorkspaceId,
        userId: inframodernUserRefs.id,
        email: inframodernUserRefs.email,
        displayName: inframodernUserRefs.displayName,
        phone: inframodernUserRefs.phone,
        avatarUrl: inframodernUserRefs.avatarUrl,
        workspaceId: workspaceRefs.id,
        workspaceName: workspaceRefs.name,
        workspaceSlug: workspaceRefs.slug,
        roleKey: workspaceMembershipRefs.roleKey,
        permissions: workspaceMembershipRefs.permissions,
        isAdmin: workspaceMembershipRefs.isAdmin,
      })
      .from(sessionRecords)
      .innerJoin(inframodernUserRefs, eq(sessionRecords.userId, inframodernUserRefs.id))
      .leftJoin(
        workspaceMembershipRefs,
        and(
          eq(workspaceMembershipRefs.userId, inframodernUserRefs.id),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
        ),
      )
      .leftJoin(
        workspaceRefs,
        and(
          eq(workspaceRefs.id, workspaceMembershipRefs.workspaceId),
          isNull(workspaceRefs.deletedAt),
        ),
      )
      .where(
        and(
          eq(sessionRecords.id, sessionId),
          isNull(sessionRecords.revokedAt),
          gt(sessionRecords.expiresAt, now),
        ),
      );

    const first = rows[0];
    if (!first) {
      return null;
    }

    const workspaceRows: {
      readonly workspaceId: string;
      readonly workspaceName: string;
      readonly workspaceSlug: string | null;
      readonly roleKey: string | null;
      readonly permissions: readonly string[];
      readonly isAdmin: boolean | null;
    }[] = rows.flatMap((row) => {
      if (!row.workspaceId || !row.workspaceName) {
        return [];
      }

      return [
        {
          workspaceId: row.workspaceId,
          workspaceName: row.workspaceName,
          workspaceSlug: row.workspaceSlug,
          roleKey: row.roleKey,
          permissions: row.permissions ?? [],
          isAdmin: row.isAdmin,
        },
      ];
    });
    const permissionsByWorkspaceId =
      await this.permissionsRepository.findEffectivePermissionsByWorkspaceIds(
        workspaceRows.map((row) => row.workspaceId),
        first.userId,
      );

    const workspaces = workspaceRows.map((row) => {
      const permissions = permissionsByWorkspaceId.get(row.workspaceId) ?? [];

      return {
        id: row.workspaceId,
        name: row.workspaceName,
        slug: row.workspaceSlug,
        roleKey: row.roleKey,
        permissions: [...(permissions.length > 0 ? permissions : row.permissions)],
        isAdmin: row.isAdmin ?? false,
      };
    });

    return {
      encryptedTokens: first.encryptedTokens,
      user: {
        id: first.userId,
        email: first.email,
        displayName: first.displayName,
        phone: first.phone,
        avatarUrl: first.avatarUrl,
        activeWorkspaceId: first.activeWorkspaceId,
        workspaces,
      },
    };
  }

  async updateTokens(sessionId: string, input: UpdateTokensInput): Promise<void> {
    await this.db
      .update(sessionRecords)
      .set({
        encryptedTokens: input.encryptedTokens,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        refreshTokenExpiresAt: input.refreshTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(sessionRecords.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(sessionRecords)
      .set({
        revokedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessionRecords.id, sessionId));
  }

  async #deactivateOmittedMemberships(
    db: BootstrapDb,
    userId: string,
    currentWorkspaceIds: readonly string[],
    now: Date,
  ): Promise<void> {
    const currentWorkspaceFilter =
      currentWorkspaceIds.length > 0
        ? notInArray(workspaceMembershipRefs.workspaceId, [...currentWorkspaceIds])
        : undefined;

    await db
      .update(workspaceMembershipRefs)
      .set({
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceMembershipRefs.userId, userId),
          isNull(workspaceMembershipRefs.deletedAt),
          currentWorkspaceFilter,
        ),
      );
  }

  #collectBootstrapWorkspaces(user: InframodernOAuthUser): BootstrapWorkspaceProjection[] {
    const workspaceMap = new Map<string, BootstrapWorkspaceProjection>();

    for (const membership of user.workspaces ?? []) {
      const workspace = membership.workspace;

      if (!workspace?.id) {
        continue;
      }

      workspaceMap.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.code ?? null,
        roleKey:
          membership.role?.localizedName?.find((entry) => entry.locale === 'en')?.value ?? null,
        permissions: [...(membership.permissions ?? [])],
        isAdmin: false,
      });
    }

    for (const workspace of user.adminWorkspaces ?? []) {
      workspaceMap.set(workspace.id, {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.code ?? null,
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      });
    }

    return [...workspaceMap.values()];
  }
}

@Injectable()
export class NestSessionRepository extends SessionRepository {
  constructor(
    @Inject(DATABASE_CLIENT) databaseClient: DatabaseClient,
    permissionsRepository: PermissionsRepository,
  ) {
    super(databaseClient.db, permissionsRepository);
  }
}
