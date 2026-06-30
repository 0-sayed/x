import { Inject, Injectable } from '@nestjs/common';
import type { AuditEventRecord, DatabaseClient } from '@materiabill/db';
import { auditEvents } from '@materiabill/db';
import { and, desc, eq, lt } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type { InsertAuditEventInput, ListAuditEventsInput } from './audit.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class AuditRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async insertEvent(input: InsertAuditEventInput): Promise<AuditEventRecord> {
    const rows = await this.#db.insert(auditEvents).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert audit event');
    }

    return row;
  }

  async listEvents(input: ListAuditEventsInput): Promise<AuditEventRecord[]> {
    const filters = [
      eq(auditEvents.workspaceId, input.workspaceId),
      input.audience ? eq(auditEvents.audience, input.audience) : undefined,
      input.before ? lt(auditEvents.occurredAt, input.before) : undefined,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

    return this.#db
      .select()
      .from(auditEvents)
      .where(and(...filters))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(input.limit);
  }
}
