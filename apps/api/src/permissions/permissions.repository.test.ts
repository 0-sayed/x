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
  selectBuilder.where.mockReturnValue(selectBuilder);

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
    select: vi.fn(() => selectBuilder),
  };

  return { calls, db, selectBuilder };
}

describe('PermissionsRepository', () => {
  it('seeds system roles, permissions, and the admin assignment for a workspace', async () => {
    const { calls, db } = createDbMock();
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

  it('replaces stale admin assignments with viewer for ordinary memberships', async () => {
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

    expect(insertedAssignments).toHaveLength(1);
    expect(calls).toEqual(
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
});
