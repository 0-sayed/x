import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { permissionKeys } from '@materiabill/contracts';

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

const foreignKeyNames = (
  table: typeof workspaceRoles | typeof rolePermissions | typeof userRoleAssignments,
) =>
  getTableConfig(table)
    .foreignKeys.map((foreignKey) => foreignKey.getName())
    .sort();

const uniqueConstraintNames = (
  table: typeof workspaceRoles | typeof rolePermissions | typeof userRoleAssignments,
) =>
  getTableConfig(table)
    .uniqueConstraints.map((constraint) => constraint.getName())
    .sort();

const sqlText = (value: unknown) =>
  (
    value as {
      queryChunks?: { value?: string[] }[];
    }
  ).queryChunks
    ?.flatMap((chunk) => chunk.value ?? [])
    .join('');

const permissionsMigrationSql = () =>
  readFileSync(new URL('../../drizzle/0003_permissions_rbac.sql', import.meta.url), 'utf8');

const permissionsSchemaSource = () =>
  readFileSync(new URL('./permissions.ts', import.meta.url), 'utf8');

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

  it('enforces workspace consistency across RBAC relationships', () => {
    expect(uniqueConstraintNames(workspaceRoles)).toContain(
      'workspace_roles_workspace_id_id_unique',
    );
    expect(foreignKeyNames(rolePermissions)).toEqual(
      expect.arrayContaining([
        'role_permissions_workspace_id_role_id_workspace_roles_workspace_id_id_fk',
      ]),
    );
    expect(foreignKeyNames(userRoleAssignments)).toEqual(
      expect.arrayContaining([
        'user_role_assignments_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk',
        'user_role_assignments_workspace_id_role_id_workspace_roles_workspace_id_id_fk',
      ]),
    );
  });

  it('constrains stored permission keys to the catalog', () => {
    const permissionKeyCheck = getTableConfig(rolePermissions).checks.find(
      (check) => check.name === 'role_permissions_permission_key_catalog_check',
    );

    expect(permissionKeyCheck).toBeDefined();
    expect(permissionsMigrationSql()).toContain(
      'CONSTRAINT "role_permissions_permission_key_catalog_check"',
    );
    expect(permissionsMigrationSql()).toContain("'workspace.view'");
    expect(permissionsMigrationSql()).toContain("'user_role_assignments.manage'");
  });

  it('builds the permission key check from the contract catalog', () => {
    const schemaSource = permissionsSchemaSource();

    expect(schemaSource).toContain("import { permissionKeys } from '@materiabill/contracts';");
    expect(schemaSource).not.toContain('const permissionCatalogKeys = [');
    for (const permissionKey of permissionKeys) {
      expect(permissionsMigrationSql()).toContain(`'${permissionKey}'`);
    }
  });
});
