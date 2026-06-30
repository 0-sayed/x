import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

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
