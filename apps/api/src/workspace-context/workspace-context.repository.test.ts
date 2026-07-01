import { sessionRecords, workspaceMembershipRefs, workspaceRefs } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { WorkspaceContextRepository } from './workspace-context.repository.js';

function createDbMock(selectRows: readonly unknown[] = [], updateRows: readonly unknown[] = []) {
  const updateCalls: { table: unknown; setArgs: unknown[]; whereArgs: unknown[] }[] = [];
  const selectBuilder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn().mockResolvedValue(selectRows),
    limit: vi.fn().mockResolvedValue(selectRows),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.innerJoin.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);

  const db = {
    select: vi.fn(() => selectBuilder),
    update: vi.fn((table: unknown) => {
      const call = { table, setArgs: [], whereArgs: [] };
      updateCalls.push(call);

      return {
        set: vi.fn((values: unknown) => {
          call.setArgs.push(values as never);

          return {
            where: vi.fn((condition: unknown) => {
              call.whereArgs.push(condition as never);

              return {
                returning: vi.fn().mockResolvedValue(updateRows),
              };
            }),
          };
        }),
      };
    }),
  };

  return { db, selectBuilder, updateCalls };
}

function collectLeaves(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (value instanceof Date) return [value.toISOString()];
  if (typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return Reflect.ownKeys(value).flatMap((key) =>
    collectLeaves((value as Record<PropertyKey, unknown>)[key], seen),
  );
}

describe('WorkspaceContextRepository', () => {
  it('finds only active membership rows joined to live workspaces', async () => {
    const { db, selectBuilder } = createDbMock([
      {
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        workspaceName: 'Demo Workspace',
        workspaceSlug: 'demo-workspace',
        paymentCurrency: 'SAR',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      },
    ]);
    const permissionsRepository = {
      findEffectivePermissions: vi.fn().mockResolvedValue(['manage_roles', 'workspace.view']),
    };
    const repository = new WorkspaceContextRepository(
      { db } as never,
      permissionsRepository as never,
    );

    await expect(
      repository.findMembershipContext(
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      ),
    ).resolves.toEqual({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      workspaceName: 'Demo Workspace',
      workspaceSlug: 'demo-workspace',
      paymentCurrency: 'SAR',
      userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      roleKey: 'workspace_admin',
      permissions: ['manage_roles', 'workspace.view'],
      isAdmin: true,
    });

    expect(selectBuilder.from).toHaveBeenCalledWith(workspaceMembershipRefs);
    expect(selectBuilder.innerJoin).toHaveBeenCalledWith(workspaceRefs, expect.any(Object));
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('3f43835d-7f3b-4b16-907b-d57db49832dd');
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('workspace_id');
    expect(conditionLeaves).toContain('user_id');
    expect(conditionLeaves).toContain('is_active');
    expect(conditionLeaves).toContain('deleted_at');
    expect(permissionsRepository.findEffectivePermissions).toHaveBeenCalledWith(
      '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      '3f43835d-7f3b-4b16-907b-d57db49832dd',
    );
  });

  it('uses empty RBAC permissions as authoritative over projected permissions', async () => {
    const { db } = createDbMock([
      {
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        workspaceName: 'Demo Workspace',
        workspaceSlug: 'demo-workspace',
        paymentCurrency: 'SAR',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      },
    ]);
    const permissionsRepository = {
      findEffectivePermissions: vi.fn().mockResolvedValue([]),
    };
    const repository = new WorkspaceContextRepository(
      { db } as never,
      permissionsRepository as never,
    );

    await expect(
      repository.findMembershipContext(
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        permissions: [],
      }),
    );
  });

  it('returns null when no membership is found', async () => {
    const { db } = createDbMock([]);
    const repository = new WorkspaceContextRepository(
      { db } as never,
      { findEffectivePermissions: vi.fn() } as never,
    );

    await expect(
      repository.findMembershipContext(
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      ),
    ).resolves.toBeNull();
  });

  it('updates the active workspace for the current user session', async () => {
    const { db, updateCalls } = createDbMock([], [{ id: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2' }]);
    const repository = new WorkspaceContextRepository(
      { db } as never,
      { findEffectivePermissions: vi.fn() } as never,
    );

    await expect(
      repository.updateActiveWorkspace(
        'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      ),
    ).resolves.toBe(true);

    expect(updateCalls[0]?.table).toBe(sessionRecords);
    expect(updateCalls[0]?.setArgs[0]).toEqual(
      expect.objectContaining({
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        updatedAt: expect.any(Date),
      }),
    );
    const conditionLeaves = collectLeaves(updateCalls[0]?.whereArgs[0]);
    expect(conditionLeaves).toContain('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2');
    expect(conditionLeaves).toContain('3f43835d-7f3b-4b16-907b-d57db49832dd');
    expect(conditionLeaves).toContain('revoked_at');
    expect(conditionLeaves).toContain('expires_at');
  });

  it('returns false when no current session row is updated', async () => {
    const { db } = createDbMock([], []);
    const repository = new WorkspaceContextRepository(
      { db } as never,
      { findEffectivePermissions: vi.fn() } as never,
    );

    await expect(
      repository.updateActiveWorkspace(
        'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      ),
    ).resolves.toBe(false);
  });
});
