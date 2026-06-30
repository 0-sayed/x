import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { rolePermissions, userRoleAssignments, workspaceRoles } from './permissions.js';

const columnNames = (
  table: typeof workspaceRoles | typeof rolePermissions | typeof userRoleAssignments,
) => Object.keys(getTableColumns(table));

const indexNames = (
  table: typeof workspaceRoles | typeof rolePermissions | typeof userRoleAssignments,
) =>
  getTableConfig(table)
    .indexes.map((index) => index.config.name)
    .sort();

const sqlText = (value: unknown) =>
  (
    value as {
      queryChunks?: { value?: string[] }[];
    }
  ).queryChunks
    ?.flatMap((chunk) => chunk.value ?? [])
    .join('');

describe('permissions schema', () => {
  it('uses stable RBAC table names', () => {
    expect(getTableName(workspaceRoles)).toBe('workspace_roles');
    expect(getTableName(rolePermissions)).toBe('role_permissions');
    expect(getTableName(userRoleAssignments)).toBe('user_role_assignments');
  });

  it('keeps workspace role columns explicit', () => {
    expect(columnNames(workspaceRoles)).toEqual([
      'id',
      'workspaceId',
      'systemKey',
      'isSystem',
      'nameEn',
      'nameAr',
      'clonedFromRoleId',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps role permission columns explicit', () => {
    expect(columnNames(rolePermissions)).toEqual([
      'roleId',
      'workspaceId',
      'permissionKey',
      'createdAt',
    ]);
  });

  it('keeps user assignment columns explicit', () => {
    expect(columnNames(userRoleAssignments)).toEqual([
      'workspaceId',
      'userId',
      'roleId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('uses stable primary keys and lookup indexes', () => {
    expect(getTableConfig(rolePermissions).primaryKeys.map((key) => key.getName())).toEqual([
      'role_permissions_role_id_permission_key_pk',
    ]);
    expect(getTableConfig(userRoleAssignments).primaryKeys.map((key) => key.getName())).toEqual([
      'user_role_assignments_workspace_id_user_id_role_id_pk',
    ]);
    expect(indexNames(workspaceRoles)).toEqual([
      'workspace_roles_system_key_idx',
      'workspace_roles_workspace_id_idx',
      'workspace_roles_workspace_system_key_unique_idx',
    ]);
    expect(indexNames(rolePermissions)).toEqual([
      'role_permissions_permission_key_idx',
      'role_permissions_workspace_id_idx',
    ]);
    expect(indexNames(userRoleAssignments)).toEqual([
      'user_role_assignments_role_id_idx',
      'user_role_assignments_user_id_idx',
      'user_role_assignments_workspace_id_idx',
    ]);
  });

  it('keeps workspace system role keys unique for active system roles only', () => {
    const systemRoleIndex = getTableConfig(workspaceRoles).indexes.find(
      (index) => index.config.name === 'workspace_roles_workspace_system_key_unique_idx',
    );

    expect(systemRoleIndex?.config.unique).toBe(true);
    expect(sqlText(systemRoleIndex?.config.where)).toBe(
      'system_key IS NOT NULL AND is_system = true AND deleted_at IS NULL',
    );
  });
});
