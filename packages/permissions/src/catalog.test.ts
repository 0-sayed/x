import { describe, expect, it } from 'vitest';

import {
  buildPermissionCatalogResponse,
  contractorPermissionKeys,
  defaultRoleTemplates,
  isPermissionKey,
  permissionCatalog,
} from './catalog.js';
import { permissionKeys } from '@materiabill/contracts';

type HasPush<T> = 'push' extends keyof T ? true : false;

describe('permission catalog', () => {
  it('matches the canonical permission key set exactly', () => {
    expect(contractorPermissionKeys).toEqual(permissionKeys);
    expect(permissionCatalog.map((entry) => entry.key)).toEqual(permissionKeys);

    const contractorPermissionKeysHavePush: HasPush<typeof contractorPermissionKeys> = false;

    expect(contractorPermissionKeysHavePush).toBe(false);
  });

  it('keeps client-only draw approval out of contractor roles', () => {
    expect(isPermissionKey('draws.approve')).toBe(false);
    expect(
      Object.values(defaultRoleTemplates).flatMap((template) => template.permissions),
    ).not.toContain('draws.approve');
  });

  it('publishes bilingual catalog labels and default role templates', () => {
    expect(permissionCatalog[0]).toEqual({
      key: 'workspace.view',
      area: 'workspace',
      labelEn: 'View workspace',
      labelAr: 'عرض مساحة العمل',
    });
    expect(permissionCatalog.find((entry) => entry.key === 'signoffs.respond')).toEqual({
      key: 'signoffs.respond',
      area: 'signoffs',
      labelEn: 'Respond to sign-offs',
      labelAr: 'الرد على الاعتمادات النهائية',
    });

    expect(defaultRoleTemplates.workspaceAdmin.nameAr).toBe('مدير مساحة العمل');
    expect(defaultRoleTemplates.projectManager.permissions).toContain('signoffs.respond');
    expect(defaultRoleTemplates.projectManager.permissions).toContain('signoffs.remind');
    expect(defaultRoleTemplates.viewer.permissions).toContain('signoffs.view');
    expect(defaultRoleTemplates.viewer.permissions).not.toContain('signoffs.respond');
    expect(defaultRoleTemplates.viewer.permissions).not.toContain('signoffs.remind');
    expect(defaultRoleTemplates.viewer.permissions).toContain('search.use');
  });

  it('builds the catalog response with bilingual permissions and role templates', () => {
    expect(buildPermissionCatalogResponse()).toEqual({
      permissions: permissionCatalog,
      roleTemplates: defaultRoleTemplates,
    });
  });

  it('seeds a workspace admin with every active contractor permission', () => {
    expect(defaultRoleTemplates.workspaceAdmin.permissions).toEqual(permissionKeys);
    expect(defaultRoleTemplates.workspaceAdmin.permissions).toContain('manage_roles');
  });

  it('seeds a project manager with draw submission but not workspace administration', () => {
    expect(defaultRoleTemplates.projectManager.permissions).toContain('draws.submit');
    expect(defaultRoleTemplates.projectManager.permissions).not.toContain('manage_roles');
    expect(defaultRoleTemplates.projectManager.permissions).not.toContain('payables.pay');
    expect(defaultRoleTemplates.projectManager.permissions).not.toContain(
      'settings.manage_defaults',
    );
  });

  it('seeds a viewer with read-only visibility permissions and search', () => {
    expect(defaultRoleTemplates.viewer.permissions).toContain('projects.view');
    expect(defaultRoleTemplates.viewer.permissions).toContain('search.use');
    expect(defaultRoleTemplates.viewer.permissions).not.toContain('projects.create');
    expect(defaultRoleTemplates.viewer.permissions).not.toContain('manage_roles');

    const viewerPermissionsHavePush: HasPush<typeof defaultRoleTemplates.viewer.permissions> =
      false;

    expect(viewerPermissionsHavePush).toBe(false);
  });
});
