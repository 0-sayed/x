import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

export type AuditEventMetadata = Record<string, unknown>;
export type AuditAudience = 'internal' | 'client';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    audience: varchar('audience', { length: 16 }).$type<AuditAudience>().notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    metadata: jsonb('metadata')
      .$type<AuditEventMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('audit_events_audience_check', sql`${table.audience} in ('internal', 'client')`),
    index('audit_events_workspace_occurred_at_idx').on(table.workspaceId, table.occurredAt),
    index('audit_events_workspace_audience_occurred_at_idx').on(
      table.workspaceId,
      table.audience,
      table.occurredAt,
    ),
  ],
);

export type AuditEventRecord = typeof auditEvents.$inferSelect;
export type NewAuditEventRecord = typeof auditEvents.$inferInsert;
