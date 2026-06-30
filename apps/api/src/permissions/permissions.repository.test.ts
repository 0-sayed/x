import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { rolePermissions, userRoleAssignments, workspaceRoles } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsRepository } from './permissions.repository.js';

function createDbMock() {
  const calls: unknown[] = [];
  const selectBuilder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn().mockResolvedValue([{ count: 1 }]),
    limit: vi.fn().mockResolvedValue([]),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.innerJoin.mockReturnValue(selectBuilder);

  const db = {
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(db)),
    insert: vi.fn((table: unknown) => {
      calls.push({ op: 'insert', table });

      return {
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f' }]),
          }),
        })),
      };
    }),
    delete: vi.fn((table: unknown) => {
      calls.push({ op: 'delete', table });
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
    update: vi.fn((table: unknown) => {
      calls.push({ op: 'update', table });
      return {
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      };
    }),
    select: vi.fn(() => selectBuilder),
  };

  return { calls, db, selectBuilder };
}

function collectLeaves(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }

  if (value instanceof Date) {
    return [value.toISOString()];
  }

  if (typeof value !== 'object') {
    return [];
  }

  if (seen.has(value)) {
    return [];
  }
  seen.add(value);

  return Reflect.ownKeys(value).flatMap((key) =>
    collectLeaves((value as Record<PropertyKey, unknown>)[key], seen),
  );
}

describe('PermissionsRepository', () => {
  it('seeds system roles, permissions, and the admin assignment for a workspace', async () => {
    const { calls, db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([{ count: 0 }]);
    const repository = new PermissionsRepository({ db } as never);

    await repository.seedWorkspaceSystemRoles({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      membershipUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      isAdmin: true,
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'insert', table: workspaceRoles }),
        expect.objectContaining({ op: 'insert', table: rolePermissions }),
        expect.objectContaining({ op: 'insert', table: userRoleAssignments }),
      ]),
    );
  });

  it('adds the admin assignment when an admin membership already has role assignments', async () => {
    const { calls, db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([{ count: 1 }]);
    const repository = new PermissionsRepository({ db } as never);

    await repository.seedWorkspaceSystemRoles({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      membershipUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      isAdmin: true,
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'insert', table: userRoleAssignments }),
      ]),
    );
  });

  it('preserves existing assignments when seeding ordinary memberships', async () => {
    const { calls, db } = createDbMock();
    const insertedAssignments: unknown[] = [];
    db.insert.mockImplementation((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === userRoleAssignments) {
          insertedAssignments.push(values);
        }

        return {
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: `${String(insertedAssignments.length)}-role-id` }]),
          }),
        };
      }),
    }));
    const repository = new PermissionsRepository({ db } as never);

    await repository.seedWorkspaceSystemRoles({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      membershipUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      isAdmin: false,
    });

    expect(insertedAssignments).toHaveLength(0);
    expect(calls).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'delete', table: userRoleAssignments }),
      ]),
    );
  });

  it('rejects mutations that would remove the last manage_roles holder', async () => {
    const { db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([{ count: 0 }]);
    const repository = new PermissionsRepository({ db } as never);

    await expect(
      repository.assertWorkspaceKeepsManageRoles('82bf0afe-b730-4046-ac0b-30f74ce1db7a'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assignment replacement when role ids are outside the workspace', async () => {
    const { db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([{ userId: '3f43835d-7f3b-4b16-907b-d57db49832dd' }]);
    selectBuilder.where.mockResolvedValueOnce([]);
    const repository = new PermissionsRepository({ db } as never);

    await expect(
      repository.replaceUserRoleAssignments({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleIds: ['01890f8e-5f47-7cc3-98c4-dc0c0c07398f'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.delete).not.toHaveBeenCalled();
  });

  it('rejects assignment replacement for inactive workspace members', async () => {
    const { db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([]);
    const repository = new PermissionsRepository({ db } as never);

    await expect(
      repository.replaceUserRoleAssignments({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleIds: ['01890f8e-5f47-7cc3-98c4-dc0c0c07398f'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.delete).not.toHaveBeenCalled();
  });

  it('rejects direct system role edits', async () => {
    const { db } = createDbMock();
    const repository = new PermissionsRepository({ db } as never);
    vi.spyOn(repository, 'findRoleSummary').mockResolvedValueOnce({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      systemKey: 'workspaceAdmin',
      isSystem: true,
      nameEn: 'Workspace Admin',
      nameAr: 'مدير مساحة العمل',
      permissions: ['manage_roles', 'workspace.view'],
      clonedFromRoleId: null,
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
    });

    await expect(
      repository.updateRole({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        roleId: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        nameEn: 'Edited',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.delete).not.toHaveBeenCalled();
  });

  it('scopes effective permission joins to the requested workspace', async () => {
    const { db, selectBuilder } = createDbMock();
    selectBuilder.where.mockResolvedValueOnce([{ permissionKey: 'workspace.view' }]);
    const repository = new PermissionsRepository({ db } as never);

    await repository.findEffectivePermissions(
      '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      '3f43835d-7f3b-4b16-907b-d57db49832dd',
    );

    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('workspace_roles');
    expect(conditionLeaves).toContain('role_permissions');
    expect(conditionLeaves.filter((leaf) => leaf === 'workspace_id').length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('updates the role timestamp when permissions change', async () => {
    const { calls, db } = createDbMock();
    const repository = new PermissionsRepository({ db } as never);
    vi.spyOn(repository, 'findRoleSummary')
      .mockResolvedValueOnce({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        systemKey: null,
        isSystem: false,
        nameEn: 'Role Editor',
        nameAr: 'محرر الأدوار',
        permissions: ['roles.view'],
        clonedFromRoleId: null,
        createdAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T00:00:00.000Z',
      })
      .mockResolvedValueOnce({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        systemKey: null,
        isSystem: false,
        nameEn: 'Role Editor',
        nameAr: 'محرر الأدوار',
        permissions: ['roles.edit'],
        clonedFromRoleId: null,
        createdAt: '2026-06-30T00:00:00.000Z',
        updatedAt: '2026-06-30T12:00:00.000Z',
      });

    await repository.updateRole({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      roleId: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      permissions: ['roles.edit'],
    });

    expect(calls).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'update', table: workspaceRoles })]),
    );
  });
});
