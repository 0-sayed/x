import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { inframodernUserRefs, workspaceMembershipRefs, workspaceRefs } from './projections.js';

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

const permissionCatalogKeys = [
  'workspace.view',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.archive',
  'agreement_terms.view',
  'agreement_terms.configure',
  'schedule.view',
  'schedule.manage',
  'schedule.propose_baseline',
  'milestones.complete',
  'draws.view',
  'draws.create',
  'draws.submit',
  'draws.release',
  'draws.release_retention',
  'payables.view',
  'payables.create',
  'payables.pay',
  'continuity.view',
  'continuity.pause',
  'budget.view',
  'budget.manage',
  'budget.set_audience',
  'materials.view',
  'materials.create',
  'materials.edit',
  'materials.receive',
  'materials.use',
  'materials.manage_po',
  'suggestions.view',
  'suggestions.resolve',
  'subcontractors.view',
  'subcontractors.create',
  'subcontractors.edit',
  'subcontractors.manage_compliance',
  'submittals.view',
  'submittals.create',
  'submittals.review',
  'submittals.approve',
  'variations.view',
  'variations.create',
  'variations.approve',
  'documents.view',
  'documents.create',
  'documents.send_for_signature',
  'documents.void',
  'manage_documents',
  'certificates.view',
  'certificates.generate',
  'signoffs.view',
  'snags.view',
  'snags.create',
  'snags.assign',
  'snags.fix',
  'manage_snags',
  'people.view',
  'roles.view',
  'roles.create',
  'roles.edit',
  'manage_roles',
  'user_role_assignments.manage',
  'branding.view',
  'branding.manage',
  'settings.view',
  'settings.manage_defaults',
  'audit.view',
  'search.use',
] as const;

const permissionCatalogSql = sql.raw(permissionCatalogKeys.map((key) => `'${key}'`).join(', '));

export const workspaceRoles = pgTable(
  'workspace_roles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    systemKey: text('system_key'),
    isSystem: boolean('is_system').notNull().default(false),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    clonedFromRoleId: uuid('cloned_from_role_id'),
    ...auditColumns(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('workspace_roles_workspace_id_idx').on(table.workspaceId),
    index('workspace_roles_system_key_idx').on(table.workspaceId, table.systemKey),
    unique('workspace_roles_workspace_id_id_unique').on(table.workspaceId, table.id),
    uniqueIndex('workspace_roles_workspace_system_key_unique_idx')
      .on(table.workspaceId, table.systemKey)
      .where(sql`system_key IS NOT NULL AND is_system = true AND deleted_at IS NULL`),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionKey],
      name: 'role_permissions_role_id_permission_key_pk',
    }),
    foreignKey({
      columns: [table.workspaceId, table.roleId],
      foreignColumns: [workspaceRoles.workspaceId, workspaceRoles.id],
      name: 'role_permissions_workspace_id_role_id_workspace_roles_workspace_id_id_fk',
    }).onDelete('cascade'),
    check(
      'role_permissions_permission_key_catalog_check',
      sql`${table.permissionKey} IN (${permissionCatalogSql})`,
    ),
    index('role_permissions_workspace_id_idx').on(table.workspaceId),
    index('role_permissions_permission_key_idx').on(table.permissionKey),
  ],
);

export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => workspaceRoles.id, { onDelete: 'cascade' }),
    ...auditColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId, table.roleId],
      name: 'user_role_assignments_workspace_id_user_id_role_id_pk',
    }),
    foreignKey({
      columns: [table.workspaceId, table.userId],
      foreignColumns: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
      name: 'user_role_assignments_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId, table.roleId],
      foreignColumns: [workspaceRoles.workspaceId, workspaceRoles.id],
      name: 'user_role_assignments_workspace_id_role_id_workspace_roles_workspace_id_id_fk',
    }).onDelete('cascade'),
    index('user_role_assignments_workspace_id_idx').on(table.workspaceId),
    index('user_role_assignments_user_id_idx').on(table.userId),
    index('user_role_assignments_role_id_idx').on(table.roleId),
  ],
);

export type WorkspaceRole = typeof workspaceRoles.$inferSelect;
export type NewWorkspaceRole = typeof workspaceRoles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type NewUserRoleAssignment = typeof userRoleAssignments.$inferInsert;
