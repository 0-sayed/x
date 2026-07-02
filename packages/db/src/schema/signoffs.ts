import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  SignOffAssignedAudience,
  SignOffRequiredAction,
  SignOffStatus,
} from '@materiabill/contracts';

import { pendingDecisions } from './grace-window.js';
import { inframodernUserRefs, workspaceRefs } from './projections.js';

export const signOffs = pgTable(
  'sign_offs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    assignedAudience: varchar('assigned_audience', { length: 16 })
      .$type<SignOffAssignedAudience>()
      .notNull(),
    requiredAction: varchar('required_action', { length: 16 })
      .$type<SignOffRequiredAction>()
      .notNull(),
    status: varchar('status', { length: 16 }).$type<SignOffStatus>().notNull(),
    requestedByUserId: uuid('requested_by_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    resolutionReason: text('resolution_reason'),
    resolutionDecisionId: uuid('resolution_decision_id').references(() => pendingDecisions.id, {
      onDelete: 'set null',
    }),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    reminderCount: integer('reminder_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'sign_offs_assigned_audience_check',
      sql`"assigned_audience" in ('org', 'participants', 'client')`,
    ),
    check('sign_offs_required_action_check', sql`"required_action" in ('approve', 'sign')`),
    check('sign_offs_status_check', sql`"status" in ('pending', 'approved', 'rejected', 'signed')`),
    check(
      'sign_offs_required_action_status_check',
      sql`"status" in ('pending', 'rejected') OR ("required_action" = 'approve' AND "status" = 'approved') OR ("required_action" = 'sign' AND "status" = 'signed')`,
    ),
    check(
      'sign_offs_reject_reason_check',
      sql`"status" != 'rejected' OR nullif(trim("resolution_reason"), '') IS NOT NULL`,
    ),
    index('sign_offs_workspace_status_created_at_idx').on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    index('sign_offs_workspace_project_status_created_at_idx').on(
      table.workspaceId,
      table.projectId,
      table.status,
      table.createdAt,
    ),
    index('sign_offs_workspace_assigned_status_idx').on(
      table.workspaceId,
      table.assignedAudience,
      table.status,
    ),
    index('sign_offs_workspace_subject_idx').on(
      table.workspaceId,
      table.subjectType,
      table.subjectId,
    ),
    index('sign_offs_requested_by_user_id_idx').on(table.requestedByUserId),
    index('sign_offs_resolved_by_user_id_idx').on(table.resolvedByUserId),
    index('sign_offs_resolution_decision_id_idx').on(table.resolutionDecisionId),
    unique('sign_offs_workspace_id_project_id_id_unique').on(
      table.workspaceId,
      table.projectId,
      table.id,
    ),
  ],
);

export type SignOffRecord = typeof signOffs.$inferSelect;
export type NewSignOffRecord = typeof signOffs.$inferInsert;
