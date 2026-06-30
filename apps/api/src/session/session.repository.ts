import { Inject, Injectable } from '@nestjs/common';
import type { CurrentSessionUser, SessionWorkspace } from '@materiabill/contracts';
import type { DatabaseClient } from '@materiabill/db';
import {
  inframodernUserRefs,
  sessionRecords,
  workspaceMembershipRefs,
  workspaceRefs,
} from '@materiabill/db';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type { InframodernOAuthUser } from './session.types.js';

type Db = DatabaseClient['db'];

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
  constructor(private readonly db: Db) {}

  async bootstrapFromInframodern(user: InframodernOAuthUser): Promise<string | null> {
    const now = new Date();
    const displayName = user.displayName ?? user.name ?? user.email;

    await this.db
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
    if (workspaces.length === 0) {
      return null;
    }

    await this.db
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
      await this.db
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
      .leftJoin(workspaceMembershipRefs, eq(workspaceMembershipRefs.userId, inframodernUserRefs.id))
      .leftJoin(workspaceRefs, eq(workspaceRefs.id, workspaceMembershipRefs.workspaceId))
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

    return {
      encryptedTokens: first.encryptedTokens,
      user: {
        id: first.userId,
        email: first.email,
        displayName: first.displayName,
        phone: first.phone,
        avatarUrl: first.avatarUrl,
        activeWorkspaceId: first.activeWorkspaceId,
        workspaces: rows.flatMap((row) => {
          if (!row.workspaceId || !row.workspaceName) {
            return [];
          }

          return [
            {
              id: row.workspaceId,
              name: row.workspaceName,
              slug: row.workspaceSlug,
              roleKey: row.roleKey,
              permissions: row.permissions ? [...row.permissions] : [],
              isAdmin: row.isAdmin ?? false,
            },
          ];
        }),
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
  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    super(databaseClient.db);
  }
}
