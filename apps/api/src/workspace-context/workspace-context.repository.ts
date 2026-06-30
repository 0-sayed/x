import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseClient } from '@materiabill/db';
import { sessionRecords, workspaceMembershipRefs, workspaceRefs } from '@materiabill/db';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';

type Db = DatabaseClient['db'];

export type WorkspaceMembershipRecord = {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly workspaceSlug: string | null;
  readonly paymentCurrency: string | null;
  readonly userId: string;
  readonly roleKey: string | null;
  readonly permissions: readonly string[];
  readonly isAdmin: boolean;
};

@Injectable()
export class WorkspaceContextRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async findMembershipContext(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembershipRecord | null> {
    const rows = await this.#db
      .select({
        workspaceId: workspaceRefs.id,
        workspaceName: workspaceRefs.name,
        workspaceSlug: workspaceRefs.slug,
        paymentCurrency: workspaceRefs.paymentCurrency,
        userId: workspaceMembershipRefs.userId,
        roleKey: workspaceMembershipRefs.roleKey,
        permissions: workspaceMembershipRefs.permissions,
        isAdmin: workspaceMembershipRefs.isAdmin,
      })
      .from(workspaceMembershipRefs)
      .innerJoin(
        workspaceRefs,
        and(
          eq(workspaceRefs.id, workspaceMembershipRefs.workspaceId),
          isNull(workspaceRefs.deletedAt),
        ),
      )
      .where(
        and(
          eq(workspaceMembershipRefs.userId, userId),
          eq(workspaceMembershipRefs.workspaceId, workspaceId),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async updateActiveWorkspace(
    sessionId: string,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    const rows = await this.#db
      .update(sessionRecords)
      .set({
        activeWorkspaceId: workspaceId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessionRecords.id, sessionId),
          eq(sessionRecords.userId, userId),
          isNull(sessionRecords.revokedAt),
          gt(sessionRecords.expiresAt, new Date()),
        ),
      )
      .returning({ id: sessionRecords.id });

    return rows.length > 0;
  }
}
