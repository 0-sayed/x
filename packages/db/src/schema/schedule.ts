import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { ScheduleBaselineStatus } from '@materiabill/contracts';

import { projects } from './projects.js';
import { workspaceMembershipRefs, workspaceRefs } from './projections.js';
import { signOffs } from './signoffs.js';

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const schedulePhases = pgTable(
  'schedule_phases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, {
        onDelete: 'cascade',
      }),
    projectId: uuid('project_id').notNull(),
    name: text('name').notNull(),
    startsOn: date('starts_on', { mode: 'string' }),
    endsOn: date('ends_on', { mode: 'string' }),
    displayOrder: integer('display_order').notNull().default(0),
    ...auditColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'schedule_phases_workspace_id_project_id_projects_workspace_id_id_fk',
    }).onDelete('cascade'),
    check('schedule_phases_display_order_check', sql`${table.displayOrder} >= 0`),
    index('schedule_phases_workspace_project_order_idx').on(
      table.workspaceId,
      table.projectId,
      table.displayOrder,
    ),
    unique('schedule_phases_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('schedule_phases_workspace_id_project_id_id_unique').on(
      table.workspaceId,
      table.projectId,
      table.id,
    ),
  ],
);

export const scheduleMilestones = pgTable(
  'schedule_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, {
        onDelete: 'cascade',
      }),
    projectId: uuid('project_id').notNull(),
    phaseId: uuid('phase_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    forecastDate: date('forecast_date', { mode: 'string' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedByUserId: uuid('completed_by_user_id'),
    displayOrder: integer('display_order').notNull().default(0),
    ...auditColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'schedule_milestones_workspace_id_project_id_projects_workspace_id_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.phaseId],
      foreignColumns: [schedulePhases.workspaceId, schedulePhases.projectId, schedulePhases.id],
      name: 'schedule_milestones_workspace_id_project_id_phase_id_schedule_phases_workspace_id_project_id_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.completedByUserId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'schedule_milestones_workspace_id_completed_by_user_id_membership_fk',
    }).onDelete('set null'),
    check('schedule_milestones_display_order_check', sql`${table.displayOrder} >= 0`),
    index('schedule_milestones_workspace_project_order_idx').on(
      table.workspaceId,
      table.projectId,
      table.displayOrder,
    ),
    index('schedule_milestones_workspace_phase_idx').on(table.workspaceId, table.phaseId),
    unique('schedule_milestones_workspace_id_id_unique').on(table.workspaceId, table.id),
    unique('schedule_milestones_workspace_id_project_id_id_unique').on(
      table.workspaceId,
      table.projectId,
      table.id,
    ),
  ],
);

export const scheduleForecastMoves = pgTable(
  'schedule_forecast_moves',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, {
        onDelete: 'cascade',
      }),
    projectId: uuid('project_id').notNull(),
    milestoneId: uuid('milestone_id').notNull(),
    oldForecastDate: date('old_forecast_date', { mode: 'string' }).notNull(),
    newForecastDate: date('new_forecast_date', { mode: 'string' }).notNull(),
    reason: text('reason').notNull(),
    movedByUserId: uuid('moved_by_user_id').notNull(),
    movedAt: timestamp('moved_at', { withTimezone: true }).notNull(),
    ...auditColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.milestoneId],
      foreignColumns: [
        scheduleMilestones.workspaceId,
        scheduleMilestones.projectId,
        scheduleMilestones.id,
      ],
      name: 'schedule_forecast_moves_workspace_id_project_id_milestone_id_milestones_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.movedByUserId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'schedule_forecast_moves_workspace_id_moved_by_user_id_membership_fk',
    }).onDelete('restrict'),
    check(
      'schedule_forecast_moves_reason_check',
      sql`nullif(trim(${table.reason}), '') is not null`,
    ),
    index('schedule_forecast_moves_workspace_project_moved_at_idx').on(
      table.workspaceId,
      table.projectId,
      table.movedAt,
    ),
  ],
);

export const scheduleBaselines = pgTable(
  'schedule_baselines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, {
        onDelete: 'cascade',
      }),
    projectId: uuid('project_id').notNull(),
    status: varchar('status', { length: 24 }).$type<ScheduleBaselineStatus>().notNull(),
    proposedByUserId: uuid('proposed_by_user_id'),
    signOffId: uuid('sign_off_id'),
    selfCertifiedByUserId: uuid('self_certified_by_user_id'),
    selfCertifiedReason: text('self_certified_reason'),
    agreedAt: timestamp('agreed_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'schedule_baselines_workspace_id_project_id_projects_workspace_id_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.proposedByUserId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'schedule_baselines_workspace_id_proposed_by_user_id_membership_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.workspaceId, table.projectId, table.signOffId],
      foreignColumns: [signOffs.workspaceId, signOffs.projectId, signOffs.id],
      name: 'schedule_baselines_workspace_id_project_id_sign_off_id_sign_offs_workspace_id_project_id_id_fk',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.workspaceId, table.selfCertifiedByUserId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'schedule_baselines_workspace_id_self_certified_by_user_id_membership_fk',
    }).onDelete('set null'),
    check(
      'schedule_baselines_status_check',
      sql`${table.status} in ('draft', 'proposed', 'agreed', 'self_certified')`,
    ),
    check(
      'schedule_baselines_self_certified_reason_check',
      sql`${table.status} != 'self_certified' OR nullif(trim(${table.selfCertifiedReason}), '') is not null`,
    ),
    index('schedule_baselines_workspace_project_status_idx').on(
      table.workspaceId,
      table.projectId,
      table.status,
    ),
    index('schedule_baselines_sign_off_id_idx').on(table.signOffId),
  ],
);

export const scheduleBaselineMilestones = pgTable(
  'schedule_baseline_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    baselineId: uuid('baseline_id')
      .notNull()
      .references(() => scheduleBaselines.id, {
        onDelete: 'cascade',
      }),
    sourceMilestoneId: uuid('source_milestone_id'),
    phaseName: text('phase_name').notNull(),
    milestoneName: text('milestone_name').notNull(),
    baselineDate: date('baseline_date', { mode: 'string' }).notNull(),
    displayOrder: integer('display_order').notNull().default(0),
  },
  (table) => [
    check('schedule_baseline_milestones_display_order_check', sql`${table.displayOrder} >= 0`),
    index('schedule_baseline_milestones_baseline_order_idx').on(
      table.baselineId,
      table.displayOrder,
    ),
  ],
);

export const milestoneDrawLinks = pgTable(
  'milestone_draw_links',
  {
    milestoneId: uuid('milestone_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    drawItemId: uuid('draw_item_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.milestoneId, table.drawItemId],
      name: 'milestone_draw_links_milestone_id_draw_item_id_pk',
    }),
    foreignKey({
      columns: [table.workspaceId, table.milestoneId],
      foreignColumns: [scheduleMilestones.workspaceId, scheduleMilestones.id],
      name: 'milestone_draw_links_workspace_id_milestone_id_milestones_fk',
    }).onDelete('cascade'),
    index('milestone_draw_links_workspace_draw_item_idx').on(table.workspaceId, table.drawItemId),
  ],
);

export type SchedulePhaseRecord = typeof schedulePhases.$inferSelect;
export type NewSchedulePhaseRecord = typeof schedulePhases.$inferInsert;
export type ScheduleMilestoneRecord = typeof scheduleMilestones.$inferSelect;
export type NewScheduleMilestoneRecord = typeof scheduleMilestones.$inferInsert;
export type ScheduleForecastMoveRecord = typeof scheduleForecastMoves.$inferSelect;
export type NewScheduleForecastMoveRecord = typeof scheduleForecastMoves.$inferInsert;
export type ScheduleBaselineRecord = typeof scheduleBaselines.$inferSelect;
export type NewScheduleBaselineRecord = typeof scheduleBaselines.$inferInsert;
export type ScheduleBaselineMilestoneRecord = typeof scheduleBaselineMilestones.$inferSelect;
export type NewScheduleBaselineMilestoneRecord = typeof scheduleBaselineMilestones.$inferInsert;
export type MilestoneDrawLinkRecord = typeof milestoneDrawLinks.$inferSelect;
export type NewMilestoneDrawLinkRecord = typeof milestoneDrawLinks.$inferInsert;
