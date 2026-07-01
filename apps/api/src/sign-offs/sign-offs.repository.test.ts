import { signOffs } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { SignOffsRepository } from './sign-offs.repository.js';

const row = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  subjectType: 'timeline_baseline',
  subjectId: 'baseline-1',
  title: 'Approve timeline baseline',
  summary: 'Client approval locks the initial baseline date.',
  assignedAudience: 'client',
  requiredAction: 'approve',
  status: 'pending',
  requestedByUserId: '44444444-4444-4444-8444-444444444444',
  resolvedByUserId: null,
  resolutionReason: null,
  resolutionDecisionId: null,
  lastReminderAt: null,
  reminderCount: 0,
  createdAt: new Date('2026-07-01T10:00:00.000Z'),
  updatedAt: new Date('2026-07-01T10:00:00.000Z'),
  resolvedAt: null,
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

  return { db, insertCalls, selectBuilder, updateCalls };
}

function collectSqlStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return [];
  }
  seen.add(value);

  if ('value' in value && Array.isArray(value.value)) {
    return value.value.filter((chunk) => typeof chunk === 'string');
  }

  return Reflect.ownKeys(value).flatMap((key) =>
    collectSqlStrings((value as Record<PropertyKey, unknown>)[key], seen),
  );
}

describe('SignOffsRepository', () => {
  it('creates a sign-off row', async () => {
    const { db, insertCalls } = createDbMock([row]);
    const repository = new SignOffsRepository({ db } as never);

    await expect(repository.create(row)).resolves.toEqual(row);

    expect(insertCalls[0]?.table).toBe(signOffs);
    expect(insertCalls[0]?.valuesArgs[0]).toMatchObject({
      workspaceId: row.workspaceId,
      status: 'pending',
      requiredAction: 'approve',
    });
  });

  it('lists workspace sign-offs with pending-first ordering and limit', async () => {
    const { db, selectBuilder } = createDbMock([], [row]);
    const repository = new SignOffsRepository({ db } as never);

    await expect(
      repository.list({
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        status: 'pending',
        assignedAudience: 'client',
        limit: 25,
      }),
    ).resolves.toEqual([row]);

    expect(selectBuilder.from).toHaveBeenCalledWith(signOffs);
    expect(selectBuilder.where).toHaveBeenCalledTimes(1);
    expect(collectSqlStrings(selectBuilder.orderBy.mock.calls[0]?.[0]).join('')).toContain(
      " = 'pending' then 0 else 1 end",
    );
    expect(selectBuilder.limit).toHaveBeenCalledWith(25);
  });

  it('finds one sign-off by workspace and id', async () => {
    const { db, selectBuilder } = createDbMock([], [row]);
    const repository = new SignOffsRepository({ db } as never);

    await expect(
      repository.findByIdInWorkspace({
        workspaceId: row.workspaceId,
        signOffId: row.id,
      }),
    ).resolves.toEqual(row);

    expect(selectBuilder.limit).toHaveBeenCalledWith(1);
  });

  it('resolves only pending sign-offs and persists the decision metadata', async () => {
    const resolvedRow = {
      ...row,
      status: 'approved',
      resolvedByUserId: '55555555-5555-4555-8555-555555555555',
      resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      resolvedAt: new Date('2026-07-01T10:10:00.000Z'),
      updatedAt: new Date('2026-07-01T10:10:00.000Z'),
    };
    const { db, updateCalls } = createDbMock([], [], [resolvedRow]);
    const repository = new SignOffsRepository({ db } as never);

    await expect(
      repository.resolve({
        workspaceId: row.workspaceId,
        signOffId: row.id,
        status: 'approved',
        resolvedByUserId: '55555555-5555-4555-8555-555555555555',
        resolutionReason: null,
        resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
        now: new Date('2026-07-01T10:10:00.000Z'),
      }),
    ).resolves.toEqual(resolvedRow);

    expect(updateCalls[0]?.table).toBe(signOffs);
    expect(updateCalls[0]?.setArgs[0]).toMatchObject({
      status: 'approved',
      resolvedByUserId: '55555555-5555-4555-8555-555555555555',
      resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      resolvedAt: new Date('2026-07-01T10:10:00.000Z'),
    });
  });

  it('marks a client pending sign-off reminder as sent', async () => {
    const remindedRow = {
      ...row,
      lastReminderAt: new Date('2026-07-01T10:05:00.000Z'),
      reminderCount: 1,
      updatedAt: new Date('2026-07-01T10:05:00.000Z'),
    };
    const { db, updateCalls } = createDbMock([], [], [remindedRow]);
    const repository = new SignOffsRepository({ db } as never);

    await expect(
      repository.markReminderSent({
        workspaceId: row.workspaceId,
        signOffId: row.id,
        now: new Date('2026-07-01T10:05:00.000Z'),
      }),
    ).resolves.toEqual(remindedRow);

    expect(updateCalls[0]?.table).toBe(signOffs);
    expect(updateCalls[0]?.setArgs[0]).toMatchObject({
      lastReminderAt: new Date('2026-07-01T10:05:00.000Z'),
      updatedAt: new Date('2026-07-01T10:05:00.000Z'),
    });
  });
});
