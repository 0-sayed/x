import { pendingDecisions } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { GraceWindowRepository } from './grace-window.repository.js';

const pendingRow = {
  id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
  workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  projectId: null,
  requestedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
  status: 'pending',
  audience: 'org',
  decisionType: 'draw.release',
  recordType: 'draw',
  recordId: 'D-104',
  summaryLabel: 'Release draw D-104',
  commitPayload: {},
  undoPayload: {},
  requestedAt: new Date('2026-07-01T09:00:00.000Z'),
  expiresAt: new Date('2026-07-01T09:10:00.000Z'),
  undoneAt: null,
  committedAt: null,
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
  updatedAt: new Date('2026-07-01T09:00:00.000Z'),
} as const;

function createDbMock(
  insertRows: readonly unknown[] = [],
  selectRows: readonly unknown[] = [],
  updateRows: readonly unknown[] = [],
) {
  const insertCalls: { table: unknown; valuesArgs: unknown[] }[] = [];
  const updateCalls: { table: unknown; setArgs: unknown[] }[] = [];
  const selectBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(selectRows),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);
  selectBuilder.orderBy.mockReturnValue(selectBuilder);

  const updateBuilder = {
    set: vi.fn((values: unknown) => {
      updateCalls[0]?.setArgs.push(values);
      return updateBuilder;
    }),
    where: vi.fn(() => updateBuilder),
    returning: vi.fn().mockResolvedValue(updateRows),
  };

  const db = {
    insert: vi.fn((table: unknown) => {
      const call = { table, valuesArgs: [] };
      insertCalls.push(call);

      return {
        values: vi.fn((values: unknown) => {
          call.valuesArgs.push(values as never);

          return {
            returning: vi.fn().mockResolvedValue(insertRows),
          };
        }),
      };
    }),
    select: vi.fn(() => selectBuilder),
    update: vi.fn((table: unknown) => {
      updateCalls.push({ table, setArgs: [] });
      return updateBuilder;
    }),
  };

  return { db, insertCalls, selectBuilder, updateBuilder, updateCalls };
}

describe('GraceWindowRepository', () => {
  it('creates one pending decision row', async () => {
    const { db, insertCalls } = createDbMock([pendingRow]);
    const repository = new GraceWindowRepository({ db } as never);

    await expect(repository.createDecision(pendingRow)).resolves.toEqual(pendingRow);

    expect(insertCalls[0]?.table).toBe(pendingDecisions);
    expect(insertCalls[0]?.valuesArgs[0]).toMatchObject({
      workspaceId: pendingRow.workspaceId,
      status: 'pending',
      expiresAt: pendingRow.expiresAt,
    });
  });

  it('lists only active pending decisions for one workspace', async () => {
    const { db, selectBuilder } = createDbMock([], [pendingRow]);
    const repository = new GraceWindowRepository({ db } as never);

    await expect(
      repository.listActive({
        workspaceId: pendingRow.workspaceId,
        now: new Date('2026-07-01T09:05:00.000Z'),
        limit: 50,
      }),
    ).resolves.toEqual([pendingRow]);

    expect(selectBuilder.from).toHaveBeenCalledWith(pendingDecisions);
    expect(selectBuilder.where).toHaveBeenCalledTimes(1);
    expect(selectBuilder.limit).toHaveBeenCalledWith(50);
  });

  it('finds an active pending decision by workspace and record identity', async () => {
    const { db } = createDbMock([], [pendingRow]);
    const repository = new GraceWindowRepository({ db } as never);

    const row = await repository.findActiveByRecord({
      workspaceId: pendingRow.workspaceId,
      decisionType: pendingRow.decisionType,
      recordType: pendingRow.recordType,
      recordId: pendingRow.recordId,
      now: new Date('2026-07-01T09:05:00.000Z'),
    });

    expect(row?.id).toBe(pendingRow.id);
  });

  it('atomically marks a pending decision undone', async () => {
    const undoneRow = {
      ...pendingRow,
      status: 'undone',
      undoneAt: new Date('2026-07-01T09:05:00.000Z'),
      updatedAt: new Date('2026-07-01T09:05:00.000Z'),
    };
    const { db, updateCalls } = createDbMock([], [], [undoneRow]);
    const repository = new GraceWindowRepository({ db } as never);

    await expect(
      repository.undoPending({
        workspaceId: pendingRow.workspaceId,
        decisionId: pendingRow.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).resolves.toEqual(undoneRow);

    expect(updateCalls[0]?.table).toBe(pendingDecisions);
    expect(updateCalls[0]?.setArgs[0]).toMatchObject({
      status: 'undone',
      undoneAt: new Date('2026-07-01T09:05:00.000Z'),
      updatedAt: new Date('2026-07-01T09:05:00.000Z'),
    });
  });

  it('atomically marks an expired pending decision committed', async () => {
    const committedRow = {
      ...pendingRow,
      status: 'committed',
      committedAt: new Date('2026-07-01T09:12:00.000Z'),
      updatedAt: new Date('2026-07-01T09:12:00.000Z'),
    };
    const { db, updateCalls } = createDbMock([], [], [committedRow]);
    const repository = new GraceWindowRepository({ db } as never);

    await expect(
      repository.commitExpired({
        workspaceId: pendingRow.workspaceId,
        decisionId: pendingRow.id,
        now: new Date('2026-07-01T09:12:00.000Z'),
      }),
    ).resolves.toEqual(committedRow);

    expect(updateCalls[0]?.table).toBe(pendingDecisions);
    expect(updateCalls[0]?.setArgs[0]).toMatchObject({
      status: 'committed',
      committedAt: new Date('2026-07-01T09:12:00.000Z'),
    });
  });
});
