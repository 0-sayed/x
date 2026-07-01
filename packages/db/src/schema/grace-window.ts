import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { DecisionAudience, PendingDecisionStatus } from '@materiabill/contracts';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

export type PendingDecisionPayload = Record<string, unknown>;

const pendingDecisionStatusSql = sql`'pending', 'undone', 'committed'`;
const decisionAudienceSql = sql`'org', 'participants', 'client'`;

export const pendingDecisions = pgTable(
  'pending_decisions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    requestedByUserId: uuid('requested_by_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 16 }).$type<PendingDecisionStatus>().notNull(),
    audience: varchar('audience', { length: 16 }).$type<DecisionAudience>().notNull(),
    decisionType: text('decision_type').notNull(),
    recordType: text('record_type').notNull(),
    recordId: text('record_id'),
    summaryLabel: text('summary_label').notNull(),
    commitPayload: jsonb('commit_payload')
      .$type<PendingDecisionPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    undoPayload: jsonb('undo_payload')
      .$type<PendingDecisionPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('pending_decisions_status_check', sql`${table.status} in (${pendingDecisionStatusSql})`),
    check('pending_decisions_audience_check', sql`${table.audience} in (${decisionAudienceSql})`),
    index('pending_decisions_workspace_status_expires_at_idx').on(
      table.workspaceId,
      table.status,
      table.expiresAt,
    ),
    index('pending_decisions_workspace_project_status_expires_at_idx').on(
      table.workspaceId,
      table.projectId,
      table.status,
      table.expiresAt,
    ),
    index('pending_decisions_requested_by_user_id_idx').on(table.requestedByUserId),
  ],
);

export type PendingDecisionRecord = typeof pendingDecisions.$inferSelect;
export type NewPendingDecisionRecord = typeof pendingDecisions.$inferInsert;
