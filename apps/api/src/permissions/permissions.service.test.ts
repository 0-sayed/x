import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsService } from './permissions.service.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const roleId = '01890f8e-5f47-7cc3-98c4-dc0c0c07398f';
const userId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

const roleSummary = {
  id: roleId,
  workspaceId,
  systemKey: null,
  isSystem: false,
  nameEn: 'Custom Admin',
  nameAr: 'مدير مخصص',
  permissions: ['workspace.view', 'manage_roles'],
  clonedFromRoleId: null,
  createdAt: '2026-06-30T00:00:00.000Z',
  updatedAt: '2026-06-30T00:00:00.000Z',
} as const;

function createRepositoryMock() {
  return {
    createRole: vi.fn().mockResolvedValue(roleSummary),
    updateRole: vi.fn().mockResolvedValue(roleSummary),
    cloneRole: vi.fn().mockResolvedValue({ ...roleSummary, clonedFromRoleId: roleId }),
    findWorkspaceRoles: vi.fn().mockResolvedValue([roleSummary]),
    findRoleSummary: vi.fn().mockResolvedValue(roleSummary),
    replaceUserRoleAssignments: vi.fn().mockResolvedValue(undefined),
    findEffectivePermissions: vi.fn().mockResolvedValue(['manage_roles', 'workspace.view']),
  };
}

describe('PermissionsService', () => {
  it('returns catalog and workspace roles', async () => {
    const repository = createRepositoryMock();
    const service = new PermissionsService(repository as never);

    expect(service.getCatalog().permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'manage_roles' })]),
    );
    await expect(service.listRoles(workspaceId)).resolves.toEqual({ roles: [roleSummary] });
    expect(repository.findWorkspaceRoles).toHaveBeenCalledWith(workspaceId);
  });

  it('validates and creates custom roles', async () => {
    const repository = createRepositoryMock();
    const service = new PermissionsService(repository as never);

    await expect(
      service.createRole(workspaceId, {
        nameEn: 'Custom Admin',
        nameAr: 'مدير مخصص',
        permissions: ['workspace.view', 'manage_roles'],
      }),
    ).resolves.toEqual(roleSummary);

    expect(repository.createRole).toHaveBeenCalledWith({
      workspaceId,
      nameEn: 'Custom Admin',
      nameAr: 'مدير مخصص',
      permissions: ['workspace.view', 'manage_roles'],
    });
  });

  it('rejects invalid role mutation bodies before calling the repository', async () => {
    const repository = createRepositoryMock();
    const service = new PermissionsService(repository as never);

    await expect(
      service.createRole(workspaceId, {
        nameEn: '',
        nameAr: 'مدير مخصص',
        permissions: ['workspace.view'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateRole(workspaceId, roleId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(repository.createRole).not.toHaveBeenCalled();
    expect(repository.updateRole).not.toHaveBeenCalled();
  });

  it('updates role permissions through the repository so the invariant is enforced there', async () => {
    const repository = createRepositoryMock();
    repository.updateRole.mockRejectedValueOnce(
      new ConflictException('At least one workspace member must keep manage_roles'),
    );
    const service = new PermissionsService(repository as never);

    await expect(
      service.updateRole(workspaceId, roleId, {
        permissions: ['workspace.view'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clones an existing role and reports missing source roles', async () => {
    const repository = createRepositoryMock();
    const service = new PermissionsService(repository as never);

    await expect(
      service.cloneRole(workspaceId, roleId, {
        nameEn: 'Cloned Admin',
        nameAr: 'مدير منسوخ',
      }),
    ).resolves.toMatchObject({ clonedFromRoleId: roleId });

    repository.cloneRole.mockResolvedValueOnce(null);
    await expect(
      service.cloneRole(workspaceId, roleId, {
        nameEn: 'Cloned Admin',
        nameAr: 'مدير منسوخ',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces user role assignments and returns effective permissions', async () => {
    const repository = createRepositoryMock();
    const service = new PermissionsService(repository as never);

    await expect(
      service.replaceUserRoleAssignments(workspaceId, {
        userId,
        roleIds: [roleId],
      }),
    ).resolves.toEqual({
      workspaceId,
      userId,
      roleIds: [roleId],
      permissions: ['manage_roles', 'workspace.view'],
    });

    expect(repository.replaceUserRoleAssignments).toHaveBeenCalledWith({
      workspaceId,
      userId,
      roleIds: [roleId],
    });
  });
});
