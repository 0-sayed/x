import { Inject, Injectable } from '@nestjs/common';
import { pendingDecisions, type DatabaseClient, type PendingDecisionRecord } from '@materiabill/db';
import { and, asc, eq, gt, lte } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  CreatePendingDecisionRecordInput,
  FindPendingDecisionInput,
  ListActivePendingDecisionsInput,
  MutatePendingDecisionInput,
} from './grace-window.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class GraceWindowRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async createDecision(input: CreatePendingDecisionRecordInput): Promise<PendingDecisionRecord> {
    const rows = await this.#db.insert(pendingDecisions).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert pending decision');
    }

    return row;
  }

  async listActive(input: ListActivePendingDecisionsInput): Promise<PendingDecisionRecord[]> {
    const filters = [
      eq(pendingDecisions.workspaceId, input.workspaceId),
      eq(pendingDecisions.status, 'pending'),
      gt(pendingDecisions.expiresAt, input.now),
      input.projectId ? eq(pendingDecisions.projectId, input.projectId) : undefined,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

    return this.#db
      .select()
      .from(pendingDecisions)
      .where(and(...filters))
      .orderBy(asc(pendingDecisions.expiresAt), asc(pendingDecisions.id))
      .limit(input.limit);
  }

  async findByIdInWorkspace(
    input: FindPendingDecisionInput,
  ): Promise<PendingDecisionRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(pendingDecisions)
      .where(
        and(
          eq(pendingDecisions.workspaceId, input.workspaceId),
          eq(pendingDecisions.id, input.decisionId),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async undoPending(input: MutatePendingDecisionInput): Promise<PendingDecisionRecord | undefined> {
    const rows = await this.#db
      .update(pendingDecisions)
      .set({
        status: 'undone',
        undoneAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(pendingDecisions.workspaceId, input.workspaceId),
          eq(pendingDecisions.id, input.decisionId),
          eq(pendingDecisions.status, 'pending'),
          gt(pendingDecisions.expiresAt, input.now),
        ),
      )
      .returning();

    return rows[0];
  }

  async commitExpired(
    input: MutatePendingDecisionInput,
  ): Promise<PendingDecisionRecord | undefined> {
    const rows = await this.#db
      .update(pendingDecisions)
      .set({
        status: 'committed',
        committedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(pendingDecisions.workspaceId, input.workspaceId),
          eq(pendingDecisions.id, input.decisionId),
          eq(pendingDecisions.status, 'pending'),
          lte(pendingDecisions.expiresAt, input.now),
        ),
      )
      .returning();

    return rows[0];
  }
}
