import {
  inframodernUserRefs,
  sessionRecords,
  workspaceMembershipRefs,
  workspaceRefs,
} from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { SessionRepository } from './session.repository.js';

type InsertCall = {
  readonly table: unknown;
  readonly valuesArgs: unknown[];
  readonly onConflictArgs: unknown[];
};

type UpdateCall = {
  readonly table: unknown;
  readonly setArgs: unknown[];
  readonly whereArgs: unknown[];
};

function createDbMock(selectRows: readonly unknown[] = []) {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];

  const selectBuilder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn().mockResolvedValue(selectRows),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.innerJoin.mockReturnValue(selectBuilder);
  selectBuilder.leftJoin.mockReturnValue(selectBuilder);

  const db = {
    insert: vi.fn((table: unknown) => {
      const call: InsertCall = {
        table,
        valuesArgs: [],
        onConflictArgs: [],
      };
      insertCalls.push(call);

      return {
        values: vi.fn((values: unknown) => {
          call.valuesArgs.push(values);

          return {
            onConflictDoUpdate: vi.fn((config: unknown) => {
              call.onConflictArgs.push(config);
              return Promise.resolve(undefined);
            }),
          };
        }),
      };
    }),
    update: vi.fn((table: unknown) => {
      const call: UpdateCall = {
        table,
        setArgs: [],
        whereArgs: [],
      };
      updateCalls.push(call);

      return {
        set: vi.fn((values: unknown) => {
          call.setArgs.push(values);

          return {
            where: vi.fn((condition: unknown) => {
              call.whereArgs.push(condition);
              return Promise.resolve(undefined);
            }),
          };
        }),
      };
    }),
    select: vi.fn(() => selectBuilder),
  };

  return {
    db,
    insertCalls,
    selectBuilder,
    updateCalls,
  };
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

describe('SessionRepository', () => {
  it('chooses the first available workspace and upserts user, workspace, and membership projections', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    const activeWorkspaceId = await repository.bootstrapFromInframodern({
      id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      phone: '+201234567890',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      locale: 'en',
      workspaces: [
        {
          workspace: {
            id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
            code: 'demo-workspace',
            name: 'Demo Workspace',
          },
          role: {
            localizedName: [{ locale: 'en', value: 'workspace_admin' }],
          },
          permissions: ['workspace.view', 'workspace.edit'],
        },
      ],
      adminWorkspaces: [
        {
          id: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
          code: 'owner-workspace',
          name: 'Owner Workspace',
        },
      ],
    });

    expect(activeWorkspaceId).toBe('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(insertCalls).toHaveLength(4);

    expect(insertCalls[0]?.valuesArgs[0]).toEqual(
      expect.objectContaining({
        id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: 'Admin User',
        phone: '+201234567890',
        avatarUrl: 'https://cdn.example.com/avatar.png',
        locale: 'en',
        rawPayload: expect.objectContaining({
          id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        }),
      }),
    );
    expect(insertCalls[0]?.onConflictArgs[0]).toEqual(
      expect.objectContaining({
        target: inframodernUserRefs.id,
        set: expect.objectContaining({
          email: 'admin@example.com',
          displayName: 'Admin User',
          phone: '+201234567890',
          avatarUrl: 'https://cdn.example.com/avatar.png',
          locale: 'en',
          rawPayload: expect.objectContaining({
            id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
          }),
          syncedAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
      }),
    );

    expect(insertCalls[1]?.valuesArgs[0]).toEqual([
      expect.objectContaining({
        id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        name: 'Demo Workspace',
        slug: 'demo-workspace',
      }),
      expect.objectContaining({
        id: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
        name: 'Owner Workspace',
        slug: 'owner-workspace',
      }),
    ]);
    expect(insertCalls[1]?.onConflictArgs[0]).toEqual(
      expect.objectContaining({
        target: workspaceRefs.id,
        set: expect.objectContaining({
          name: expect.any(Object),
          slug: expect.any(Object),
          rawPayload: expect.any(Object),
          syncedAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
      }),
    );

    expect(insertCalls[2]?.valuesArgs[0]).toEqual(
      expect.objectContaining({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleKey: 'workspace_admin',
        permissions: ['workspace.view', 'workspace.edit'],
        isAdmin: false,
      }),
    );
    expect(insertCalls[2]?.valuesArgs[0]).not.toHaveProperty('id');
    expect(insertCalls[2]?.onConflictArgs[0]).toEqual(
      expect.objectContaining({
        target: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
        set: expect.objectContaining({
          roleKey: 'workspace_admin',
          permissions: ['workspace.view', 'workspace.edit'],
          isAdmin: false,
          isActive: true,
          rawPayload: expect.objectContaining({
            id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
          }),
          syncedAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
      }),
    );

    expect(insertCalls[3]?.valuesArgs[0]).toEqual(
      expect.objectContaining({
        workspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      }),
    );
    expect(insertCalls[3]?.valuesArgs[0]).not.toHaveProperty('id');
    expect(insertCalls[3]?.onConflictArgs[0]).toEqual(
      expect.objectContaining({
        target: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
        set: expect.objectContaining({
          roleKey: 'workspace_admin',
          permissions: ['workspace.view'],
          isAdmin: true,
          isActive: true,
          rawPayload: expect.objectContaining({
            id: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
          }),
          syncedAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: null,
        }),
      }),
    );
  });

  it('returns null when bootstrap data has no workspaces', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    await expect(
      repository.bootstrapFromInframodern({
        id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: null,
        workspaces: [],
        adminWorkspaces: [],
      }),
    ).resolves.toBeNull();

    expect(insertCalls).toHaveLength(1);
  });

  it('deactivates memberships omitted from the latest bootstrap payload', async () => {
    const { db, updateCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    await repository.bootstrapFromInframodern({
      id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      workspaces: [
        {
          workspace: {
            id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
            code: 'demo-workspace',
            name: 'Demo Workspace',
          },
          permissions: ['workspace.view'],
        },
      ],
      adminWorkspaces: [],
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(workspaceMembershipRefs);
    expect(updateCalls[0]?.setArgs[0]).toEqual(
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    const conditionLeaves = collectLeaves(updateCalls[0]?.whereArgs[0]);

    expect(conditionLeaves).toContain('3f43835d-7f3b-4b16-907b-d57db49832dd');
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
  });

  it('deactivates all memberships when bootstrap data has no workspaces', async () => {
    const { db, updateCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    await repository.bootstrapFromInframodern({
      id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      workspaces: [],
      adminWorkspaces: [],
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.table).toBe(workspaceMembershipRefs);
    expect(updateCalls[0]?.setArgs[0]).toEqual(
      expect.objectContaining({
        isActive: false,
        deletedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    const conditionLeaves = collectLeaves(updateCalls[0]?.whereArgs[0]);

    expect(conditionLeaves).toContain('3f43835d-7f3b-4b16-907b-d57db49832dd');
  });

  it('persists new sessions and returns the inserted session id', async () => {
    const { db, insertCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    const sessionId = await repository.createSession({
      userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      encryptedTokens: 'encrypted-token-payload',
      accessTokenExpiresAt: new Date('2026-06-30T11:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2026-07-01T11:00:00.000Z'),
      expiresAt: new Date('2026-06-30T18:00:00.000Z'),
    });

    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(insertCalls.at(-1)?.table).toBe(sessionRecords);
    expect(insertCalls.at(-1)?.valuesArgs[0]).toEqual(
      expect.objectContaining({
        id: sessionId,
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        encryptedTokens: 'encrypted-token-payload',
      }),
    );
  });

  it('queries only current sessions and returns the current user plus encrypted tokens', async () => {
    const now = new Date('2026-06-30T12:00:00.000Z');
    const { db, selectBuilder } = createDbMock([
      {
        sessionId: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        encryptedTokens: 'encrypted-token-payload',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: 'Admin User',
        phone: null,
        avatarUrl: 'https://cdn.example.com/avatar.png',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        workspaceName: 'Demo Workspace',
        workspaceSlug: 'demo-workspace',
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      },
      {
        sessionId: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        encryptedTokens: 'encrypted-token-payload',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: 'Admin User',
        phone: null,
        avatarUrl: 'https://cdn.example.com/avatar.png',
        workspaceId: null,
        workspaceName: null,
        workspaceSlug: null,
        roleKey: null,
        permissions: [],
        isAdmin: false,
      },
    ]);
    const repository = new SessionRepository(db as never);

    await expect(
      repository.findCurrentUserBySessionId('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2', now),
    ).resolves.toEqual({
      encryptedTokens: 'encrypted-token-payload',
      user: {
        id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: 'Admin User',
        phone: null,
        avatarUrl: 'https://cdn.example.com/avatar.png',
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        workspaces: [
          {
            id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
            name: 'Demo Workspace',
            slug: 'demo-workspace',
            roleKey: 'workspace_admin',
            permissions: ['workspace.view'],
            isAdmin: true,
          },
        ],
      },
    });

    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);

    expect(conditionLeaves).toContain('session_records');
    expect(conditionLeaves).toContain('id');
    expect(conditionLeaves).toContain('revoked_at');
    expect(conditionLeaves).toContain('expires_at');
    expect(conditionLeaves).toContain('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2');
    expect(conditionLeaves).toContain(now.toISOString());

    const membershipJoinLeaves = collectLeaves(selectBuilder.leftJoin.mock.calls[0]?.[1]);
    expect(membershipJoinLeaves).toContain('is_active');
    expect(membershipJoinLeaves).toContain('true');
    expect(membershipJoinLeaves).toContain('deleted_at');

    const workspaceJoinLeaves = collectLeaves(selectBuilder.leftJoin.mock.calls[1]?.[1]);
    expect(workspaceJoinLeaves).toContain('deleted_at');
  });

  it('returns null when a current session cannot be found', async () => {
    const { db } = createDbMock([]);
    const repository = new SessionRepository(db as never);

    await expect(
      repository.findCurrentUserBySessionId('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2'),
    ).resolves.toBeNull();
  });

  it('updates and revokes sessions by id', async () => {
    const { db, updateCalls } = createDbMock();
    const repository = new SessionRepository(db as never);

    await repository.updateTokens('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2', {
      encryptedTokens: 'rotated-token-payload',
      accessTokenExpiresAt: new Date('2026-06-30T13:00:00.000Z'),
      refreshTokenExpiresAt: new Date('2026-07-01T13:00:00.000Z'),
    });
    await repository.revokeSession('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2');

    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]?.table).toBe(sessionRecords);
    expect(updateCalls[0]?.setArgs[0]).toEqual(
      expect.objectContaining({
        encryptedTokens: 'rotated-token-payload',
        accessTokenExpiresAt: new Date('2026-06-30T13:00:00.000Z'),
        refreshTokenExpiresAt: new Date('2026-07-01T13:00:00.000Z'),
        updatedAt: expect.any(Date),
      }),
    );
    expect(collectLeaves(updateCalls[0]?.whereArgs[0])).toContain(
      'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
    );

    expect(updateCalls[1]?.setArgs[0]).toEqual(
      expect.objectContaining({
        revokedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    );
    expect(collectLeaves(updateCalls[1]?.whereArgs[0])).toContain(
      'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
    );
  });
});
