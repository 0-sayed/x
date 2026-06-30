import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export type SyncEnvelopePayload = {
  readonly items: readonly unknown[];
  readonly correlationId: string;
  readonly jobId?: string;
  readonly operationId?: string;
  readonly targetApp?: string;
};

export type SyncCheckpointCursor = Record<string, unknown>;

export const syncInbox = pgTable(
  'sync_inbox',
  {
    eventId: text('event_id').primaryKey(),
    resource: text('resource').notNull(),
    correlationId: text('correlation_id').notNull(),
    operationId: text('operation_id'),
    jobId: text('job_id'),
    targetApp: text('target_app'),
    payload: jsonb('payload').$type<SyncEnvelopePayload>().notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [index('sync_inbox_resource_received_at_idx').on(table.resource, table.receivedAt)],
);

export const syncFailures = pgTable(
  'sync_failures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: text('event_id')
      .notNull()
      .references(() => syncInbox.eventId, { onDelete: 'cascade' }),
    resource: text('resource').notNull(),
    correlationId: text('correlation_id').notNull(),
    operationId: text('operation_id'),
    jobId: text('job_id'),
    payload: jsonb('payload').$type<SyncEnvelopePayload>().notNull(),
    errorMessage: text('error_message').notNull(),
    errorStack: text('error_stack'),
    retryCount: integer('retry_count').notNull().default(0),
    failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sync_failures_event_id_idx').on(table.eventId),
    index('sync_failures_resource_failed_at_idx').on(table.resource, table.failedAt),
    index('sync_failures_resolved_at_idx').on(table.resolvedAt),
  ],
);

export const syncCheckpoints = pgTable('sync_checkpoints', {
  resource: text('resource').primaryKey(),
  cursor: jsonb('cursor')
    .$type<SyncCheckpointCursor>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  lastEventId: text('last_event_id'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SyncInbox = typeof syncInbox.$inferSelect;
export type NewSyncInbox = typeof syncInbox.$inferInsert;
export type SyncFailure = typeof syncFailures.$inferSelect;
export type NewSyncFailure = typeof syncFailures.$inferInsert;
export type SyncCheckpoint = typeof syncCheckpoints.$inferSelect;
export type NewSyncCheckpoint = typeof syncCheckpoints.$inferInsert;
