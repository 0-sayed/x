import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { ProjectStatus } from '@materiabill/contracts';

import {
  inframodernUserRefs,
  locationRefs,
  workspaceMembershipRefs,
  workspaceRefs,
} from './projections.js';

const projectStatusSql = sql`'on_plan', 'behind', 'stale'`;

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    city: text('city').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    status: varchar('status', { length: 16 }).$type<ProjectStatus>().notNull().default('on_plan'),
    now: text('now'),
    bottleneck: text('bottleneck'),
    baselineDeliveryDate: date('baseline_delivery_date', { mode: 'string' }).notNull(),
    pmUserId: uuid('pm_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    locationId: uuid('location_id').references(() => locationRefs.id, { onDelete: 'set null' }),
    clientOrgId: uuid('client_org_id').references(() => workspaceRefs.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...auditColumns(),
  },
  (table) => [
    check('projects_status_check', sql`${table.status} in (${projectStatusSql})`),
    unique('projects_workspace_id_id_unique').on(table.workspaceId, table.id),
    index('projects_workspace_archived_status_city_idx').on(
      table.workspaceId,
      table.archivedAt,
      table.status,
      table.city,
    ),
    index('projects_workspace_pm_user_idx').on(table.workspaceId, table.pmUserId),
    index('projects_workspace_client_org_idx').on(table.workspaceId, table.clientOrgId),
  ],
);

export const projectParticipants = pgTable(
  'project_participants',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'cascade' }),
    roleLabel: text('role_label').notNull(),
    ...auditColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.userId],
      name: 'project_participants_project_id_user_id_pk',
    }),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'project_participants_workspace_id_project_id_projects_workspace_id_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.userId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'project_participants_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk',
    }).onDelete('cascade'),
    index('project_participants_workspace_user_idx').on(table.workspaceId, table.userId),
  ],
);

export type ProjectRecord = typeof projects.$inferSelect;
export type NewProjectRecord = typeof projects.$inferInsert;
export type ProjectParticipantRecord = typeof projectParticipants.$inferSelect;
export type NewProjectParticipantRecord = typeof projectParticipants.$inferInsert;
