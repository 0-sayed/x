import { permissionKeys } from '@materiabill/contracts';
import { describe, expect, it } from 'vitest';

import {
  contractorPermissionKeys,
  defaultRoleTemplates,
  isPermissionKey,
  permissionCatalog,
} from './catalog.js';

describe('permission catalog', () => {
  it('matches the canonical permission key set exactly', () => {
    expect(contractorPermissionKeys).toEqual(permissionKeys);
    expect(permissionCatalog.map((entry) => entry.key)).toEqual(permissionKeys);

    // @ts-expect-error exported permission keys are readonly API.
    contractorPermissionKeys.push('workspace.view');
  });

  it('keeps client-only draw approval out of contractor roles', () => {
    expect(isPermissionKey('draws.approve')).toBe(false);
    expect(
      Object.values(defaultRoleTemplates).flatMap((template) => template.permissions),
    ).not.toContain('draws.approve');
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

    // @ts-expect-error exported template permissions are readonly API.
    defaultRoleTemplates.viewer.permissions.push('projects.view');
  });
});
