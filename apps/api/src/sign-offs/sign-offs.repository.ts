import { Inject, Injectable } from '@nestjs/common';
import { signOffs, type DatabaseClient, type SignOffRecord } from '@materiabill/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  CreateSignOffRecordInput,
  DeletePendingSignOffInput,
  FindSignOffInput,
  ListSignOffRowsInput,
  MarkSignOffReminderSentInput,
  ResolveSignOffRowInput,
} from './sign-offs.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class SignOffsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async create(input: CreateSignOffRecordInput): Promise<SignOffRecord> {
    const rows = await this.#db.insert(signOffs).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert sign-off');
    }

    return row;
  }

  async list(input: ListSignOffRowsInput): Promise<SignOffRecord[]> {
    const filters = [
      eq(signOffs.workspaceId, input.workspaceId),
      input.projectId ? eq(signOffs.projectId, input.projectId) : undefined,
      input.status ? eq(signOffs.status, input.status) : undefined,
      input.assignedAudience ? eq(signOffs.assignedAudience, input.assignedAudience) : undefined,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

    return this.#db
      .select()
      .from(signOffs)
      .where(and(...filters))
      .orderBy(
        sql`case when ${signOffs.status} = 'pending' then 0 else 1 end`,
        desc(signOffs.createdAt),
        asc(signOffs.id),
      )
      .limit(input.limit);
  }

  async findByIdInWorkspace(input: FindSignOffInput): Promise<SignOffRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(signOffs)
      .where(and(eq(signOffs.workspaceId, input.workspaceId), eq(signOffs.id, input.signOffId)))
      .limit(1);

    return rows[0];
  }

  async deletePending(input: DeletePendingSignOffInput): Promise<SignOffRecord | undefined> {
    const rows = await this.#db
      .delete(signOffs)
      .where(
        and(
          eq(signOffs.workspaceId, input.workspaceId),
          eq(signOffs.id, input.signOffId),
          eq(signOffs.status, 'pending'),
        ),
      )
      .returning();

    return rows[0];
  }

  async resolve(input: ResolveSignOffRowInput): Promise<SignOffRecord | undefined> {
    const rows = await this.#db
      .update(signOffs)
      .set({
        status: input.status,
        resolvedByUserId: input.resolvedByUserId,
        resolutionReason: input.resolutionReason,
        resolutionDecisionId: input.resolutionDecisionId,
        resolvedAt: input.now,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(signOffs.workspaceId, input.workspaceId),
          eq(signOffs.id, input.signOffId),
          eq(signOffs.status, 'pending'),
        ),
      )
      .returning();

    return rows[0];
  }

  async markReminderSent(input: MarkSignOffReminderSentInput): Promise<SignOffRecord | undefined> {
    const rows = await this.#db
      .update(signOffs)
      .set({
        lastReminderAt: input.now,
        reminderCount: sql`${signOffs.reminderCount} + 1`,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(signOffs.workspaceId, input.workspaceId),
          eq(signOffs.id, input.signOffId),
          eq(signOffs.status, 'pending'),
          eq(signOffs.assignedAudience, 'client'),
        ),
      )
      .returning();

    return rows[0];
  }
}
