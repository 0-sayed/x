import { describe, expect, it, vi } from 'vitest';

import { projectParticipants, projects, workspaceMembershipRefs } from '@materiabill/db';
import { ProjectsRepository } from './projects.repository.js';

function createDbMock(selectRows: readonly unknown[] = [], updateRows: readonly unknown[] = []) {
  const calls: unknown[] = [];
  const selectBuilder = {
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    groupBy: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(selectRows),
    then: vi.fn((onFulfilled: (value: readonly unknown[]) => unknown) =>
      Promise.resolve(onFulfilled(selectRows)),
    ),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.leftJoin.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);
  selectBuilder.groupBy.mockReturnValue(selectBuilder);
  selectBuilder.orderBy.mockReturnValue(selectBuilder);

  const updateCalls: { table: unknown; setArgs: unknown[]; whereArgs: unknown[] }[] = [];
  const transactionDb = {
    select: vi.fn(() => selectBuilder),
    delete: vi.fn((table: unknown) => {
      calls.push({ op: 'delete', table });
      return {
        where: vi.fn().mockResolvedValue(undefined),
      };
    }),
    insert: vi.fn((table: unknown) => {
      calls.push({ op: 'insert', table });
      return {
        values: vi.fn((values: unknown) => ({
          returning: vi.fn().mockResolvedValue(Array.isArray(values) ? values : [values]),
        })),
      };
    }),
  };

  const db = {
    select: vi.fn(() => selectBuilder),
    insert: vi.fn((table: unknown) => {
      calls.push({ op: 'insert', table });
      return {
        values: vi.fn((values: unknown) => ({
          returning: vi.fn().mockResolvedValue(Array.isArray(values) ? values : [values]),
        })),
      };
    }),
    update: vi.fn((table: unknown) => {
      calls.push({ op: 'update', table });
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
    delete: transactionDb.delete,
    transaction: vi.fn((callback: (tx: typeof transactionDb) => unknown) =>
      callback(transactionDb),
    ),
  };

  return { calls, db, selectBuilder, updateCalls };
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

function collectConditionColumnNames(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined || typeof value !== 'object' || seen.has(value)) {
    return [];
  }

  seen.add(value);

  if ('name' in value && typeof value.name === 'string') {
    return [value.name];
  }

  if ('queryChunks' in value && Array.isArray(value.queryChunks)) {
    return value.queryChunks.flatMap((chunk) => collectConditionColumnNames(chunk, seen));
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectConditionColumnNames(item, seen));
  }

  return [];
}

describe('ProjectsRepository', () => {
  it('creates projects in the selected workspace', async () => {
    const { calls, db } = createDbMock();
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.createProject({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        status: 'on_plan',
        now: null,
        bottleneck: null,
        baselineDeliveryDate: '2026-12-15',
        pmUserId: null,
        locationId: null,
        clientOrgId: null,
        createdByUserId: null,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        baselineDeliveryDate: '2026-12-15',
      }),
    );

    expect(calls).toEqual([expect.objectContaining({ op: 'insert', table: projects })]);
  });

  it('lists projects through a workspace-scoped grouped query', async () => {
    const { db, selectBuilder } = createDbMock([
      {
        project: {
          id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
          workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
          name: 'Villa A12',
          city: 'Riyadh',
          currency: 'SAR',
          status: 'on_plan',
          now: null,
          bottleneck: null,
          baselineDeliveryDate: '2026-12-15',
          pmUserId: null,
          locationId: null,
          clientOrgId: null,
          createdByUserId: null,
          archivedAt: null,
          createdAt: new Date('2026-07-01T09:00:00.000Z'),
          updatedAt: new Date('2026-07-01T09:00:00.000Z'),
        },
        participantCount: '2',
      },
    ]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.listProjects({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        includeArchived: false,
        limit: 20,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        participantCount: 2,
      }),
    ]);

    expect(selectBuilder.from).toHaveBeenCalledWith(projects);
    expect(selectBuilder.leftJoin).toHaveBeenCalledWith(projectParticipants, expect.any(Object));
    expect(selectBuilder.groupBy).toHaveBeenCalledWith(projects.id);
    expect(selectBuilder.limit).toHaveBeenCalledWith(20);
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('workspace_id');
    expect(conditionLeaves).toContain('archived_at');
  });

  it('updates only mutable project fields inside one workspace', async () => {
    const updatedAt = new Date('2026-07-01T10:00:00.000Z');
    const updatedRow = {
      id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      name: 'Villa A12 Phase 2',
      city: 'Riyadh',
      currency: 'SAR',
      status: 'behind',
      now: 'Chasing permit approval',
      bottleneck: 'Permit approval',
      baselineDeliveryDate: '2026-12-15',
      pmUserId: null,
      locationId: null,
      clientOrgId: null,
      createdByUserId: null,
      archivedAt: null,
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt,
    };
    const { db, updateCalls } = createDbMock([], [updatedRow]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.updateProject({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        name: 'Villa A12 Phase 2',
        status: 'behind',
        now: 'Chasing permit approval',
        bottleneck: 'Permit approval',
      }),
    ).resolves.toEqual(updatedRow);

    expect(updateCalls[0]?.table).toBe(projects);
    expect(updateCalls[0]?.setArgs[0]).toEqual({
      name: 'Villa A12 Phase 2',
      status: 'behind',
      now: 'Chasing permit approval',
      bottleneck: 'Permit approval',
    });
    const conditionLeaves = collectLeaves(updateCalls[0]?.whereArgs[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('c5d9ed84-6469-4889-995d-cd38994fb7dd');
    expect(conditionLeaves).toContain('archived_at');
  });

  it('finds one project inside the selected workspace', async () => {
    const projectRow = {
      id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      name: 'Villa A12',
      city: 'Riyadh',
      currency: 'SAR',
      status: 'on_plan',
      now: null,
      bottleneck: null,
      baselineDeliveryDate: '2026-12-15',
      pmUserId: null,
      locationId: null,
      clientOrgId: null,
      createdByUserId: null,
      archivedAt: null,
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:00:00.000Z'),
    };
    const { db, selectBuilder } = createDbMock([projectRow]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.findProject({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      }),
    ).resolves.toEqual(projectRow);

    expect(selectBuilder.from).toHaveBeenCalledWith(projects);
    expect(selectBuilder.limit).toHaveBeenCalledWith(1);
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('c5d9ed84-6469-4889-995d-cd38994fb7dd');
  });

  it('archives through a workspace-scoped update', async () => {
    const archivedAt = new Date('2026-07-01T09:00:00.000Z');
    const archivedRow = {
      id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      archivedAt,
      updatedAt: archivedAt,
    };
    const { calls, db, updateCalls } = createDbMock([], [archivedRow]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.archiveProject({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        archivedAt,
      }),
    ).resolves.toEqual(archivedRow);

    expect(calls).toEqual([expect.objectContaining({ op: 'update', table: projects })]);
    expect(updateCalls[0]?.setArgs[0]).toEqual({ archivedAt, updatedAt: archivedAt });
  });

  it('lists participants inside one workspace project', async () => {
    const participantRow = {
      projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      roleLabel: 'Project Manager',
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:00:00.000Z'),
    };
    const { db, selectBuilder } = createDbMock([participantRow]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.listParticipants({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      }),
    ).resolves.toEqual([participantRow]);

    expect(selectBuilder.from).toHaveBeenCalledWith(projectParticipants);
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('c5d9ed84-6469-4889-995d-cd38994fb7dd');
  });

  it('replaces participants transactionally', async () => {
    const { calls, db } = createDbMock([{ id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd' }]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.replaceParticipants({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        participants: [
          {
            userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
            roleLabel: 'Project Manager',
          },
        ],
      }),
    ).resolves.toEqual([
      {
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        roleLabel: 'Project Manager',
      },
    ]);

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'delete', table: projectParticipants }),
        expect.objectContaining({ op: 'insert', table: projectParticipants }),
      ]),
    );
  });

  it('does not replace participants when the project is archived or missing', async () => {
    const { calls, db } = createDbMock([]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.replaceParticipants({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        participants: [
          {
            userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
            roleLabel: 'Project Manager',
          },
        ],
      }),
    ).resolves.toBeUndefined();

    expect(calls).toEqual([]);
  });

  it('finds only active workspace membership user ids', async () => {
    const { db, selectBuilder } = createDbMock([
      { userId: '3f43835d-7f3b-4b16-907b-d57db49832dd' },
      { userId: '641fdfad-2078-4a14-a245-68d2ff465a1d' },
    ]);
    const repository = new ProjectsRepository({ db } as never);

    await expect(
      repository.findActiveMembershipUserIds('82bf0afe-b730-4046-ac0b-30f74ce1db7a', [
        '3f43835d-7f3b-4b16-907b-d57db49832dd',
        '641fdfad-2078-4a14-a245-68d2ff465a1d',
      ]),
    ).resolves.toEqual(
      new Set(['3f43835d-7f3b-4b16-907b-d57db49832dd', '641fdfad-2078-4a14-a245-68d2ff465a1d']),
    );

    expect(selectBuilder.from).toHaveBeenCalledWith(workspaceMembershipRefs);
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('user_id');
    expect(collectConditionColumnNames(selectBuilder.where.mock.calls[0]?.[0])).toEqual(
      expect.arrayContaining(['workspace_id', 'is_active', 'deleted_at', 'user_id']),
    );
  });
});
