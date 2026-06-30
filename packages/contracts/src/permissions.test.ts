import { describe, expect, it } from 'vitest';

import {
  cloneRoleRequestSchema,
  createRoleRequestSchema,
  isPermissionKey,
  permissionCatalogSchema,
  permissionKeySchema,
  permissionKeys,
  replaceUserRoleAssignmentsRequestSchema,
  roleSummarySchema,
  updateRoleRequestSchema,
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

  it('validates role summaries with bilingual names and permission keys', () => {
    expect(
      roleSummarySchema.parse({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        systemKey: 'workspaceAdmin',
        isSystem: true,
        nameEn: 'Workspace Admin',
        nameAr: 'مدير مساحة العمل',
        permissions: ['workspace.view', 'manage_roles'],
        clonedFromRoleId: null,
        createdAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T00:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        systemKey: 'workspaceAdmin',
        isSystem: true,
        permissions: ['workspace.view', 'manage_roles'],
      }),
    );
  });

  it('rejects client-only permission keys in role mutation requests', () => {
    expect(() =>
      createRoleRequestSchema.parse({
        nameEn: 'Draw Approver',
        nameAr: 'معتمد الدفعات',
        permissions: ['draws.approve'],
      }),
    ).toThrow();

    expect(() =>
      updateRoleRequestSchema.parse({
        permissions: ['draws.approve'],
      }),
    ).toThrow();
  });

  it('validates clone and user role assignment requests', () => {
    expect(
      cloneRoleRequestSchema.parse({
        nameEn: 'Custom Admin',
        nameAr: 'مدير مخصص',
      }),
    ).toEqual({
      nameEn: 'Custom Admin',
      nameAr: 'مدير مخصص',
    });

    expect(
      replaceUserRoleAssignmentsRequestSchema.parse({
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleIds: ['01890f8e-5f47-7cc3-98c4-dc0c0c07398f'],
      }),
    ).toEqual({
      userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      roleIds: ['01890f8e-5f47-7cc3-98c4-dc0c0c07398f'],
    });
  });
});
