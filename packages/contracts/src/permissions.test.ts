import { describe, expect, it } from 'vitest';

import {
  isPermissionKey,
  permissionCatalogSchema,
  permissionKeySchema,
  permissionKeys,
} from './permissions.js';

describe('permission contracts', () => {
  it('exposes the contractor admin permission keys from planning seed data', () => {
    expect(permissionKeys).toContain('workspace.view');
    expect(permissionKeys).toContain('projects.create');
    expect(permissionKeys).toContain('payables.pay');
    expect(permissionKeys).toContain('manage_roles');
    expect(permissionKeys).not.toContain('draws.approve');
  });

  it('parses permission keys and catalogs', () => {
    expect(permissionKeySchema.parse('workspace.view')).toBe('workspace.view');
    expect(permissionCatalogSchema.parse(['workspace.view', 'manage_roles'])).toEqual([
      'workspace.view',
      'manage_roles',
    ]);
  });

  it('rejects unknown and client-only permission keys', () => {
    expect(() => permissionKeySchema.parse('draws.approve')).toThrow();
    expect(() => permissionKeySchema.parse('bootstrap.read')).toThrow();
  });

  it('narrows permission key strings', () => {
    expect(isPermissionKey('settings.manage_defaults')).toBe(true);
    expect(isPermissionKey('draws.approve')).toBe(false);
  });
});
