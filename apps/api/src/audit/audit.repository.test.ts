import { auditEvents } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { AuditRepository } from './audit.repository.js';
import type { InsertAuditEventInput } from './audit.types.js';

function createDbMock(insertRows: readonly unknown[] = [], selectRows: readonly unknown[] = []) {
  const insertCalls: { table: unknown; valuesArgs: unknown[] }[] = [];
  const selectBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(selectRows),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);
  selectBuilder.orderBy.mockReturnValue(selectBuilder);

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
  };

  return { db, insertCalls, selectBuilder };
}

type SqlChunk = {
  readonly queryChunks: readonly unknown[];
};

type Comparison = {
  readonly columnName: string;
  readonly operator: string;
  readonly value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getColumnName(value: unknown): string | undefined {
  return isRecord(value) && typeof value.name === 'string' ? value.name : undefined;
}

function getStringChunk(value: unknown): string | undefined {
  if (!isRecord(value) || !Array.isArray(value.value)) return undefined;
  return typeof value.value[0] === 'string' ? value.value[0] : undefined;
}

function getParamValue(value: unknown): unknown {
  return isRecord(value) && 'value' in value ? value.value : undefined;
}

function chunkMatches(value: unknown, expected: Record<string, unknown>): boolean {
  try {
    expect(value).toMatchObject(expected);
    return true;
  } catch {
    return false;
  }
}

function expectSqlChunk(value: unknown): SqlChunk {
  expect(value).toMatchObject({ queryChunks: expect.any(Array) });
  return value as SqlChunk;
}

function collectComparisons(value: unknown): Comparison[] {
  const chunks = expectSqlChunk(value).queryChunks;
  const comparisons: Comparison[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const columnName = getColumnName(chunk);
    const operator = getStringChunk(chunks[index + 1])?.trim();
    if (columnName && operator) {
      comparisons.push({
        columnName,
        operator,
        value: getParamValue(chunks[index + 2]),
      });
    }
    if (isRecord(chunk) && Array.isArray(chunk.queryChunks)) {
      comparisons.push(...collectComparisons(chunk));
    }
  }

  return comparisons;
}

function collectStringChunks(value: unknown): string[] {
  const chunks = expectSqlChunk(value).queryChunks;
  const strings: string[] = [];

  for (const chunk of chunks) {
    const stringChunk = getStringChunk(chunk);
    if (stringChunk !== undefined) {
      strings.push(stringChunk);
    }
    if (isRecord(chunk) && Array.isArray(chunk.queryChunks)) {
      strings.push(...collectStringChunks(chunk));
    }
  }

  return strings;
}

function expectDescendingColumn(value: unknown, columnName: string): void {
  const chunks = expectSqlChunk(value).queryChunks;
  const columnIndex = chunks.findIndex((chunk) => chunkMatches(chunk, { name: columnName }));

  expect(columnIndex).toBeGreaterThanOrEqual(0);
  expect(chunks[columnIndex + 1]).toMatchObject({ value: [' desc'] });
}

describe('AuditRepository', () => {
  it('inserts one append-only audit event row', async () => {
    const occurredAt = new Date('2026-06-30T12:00:00.000Z');
    const input: InsertAuditEventInput = {
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      actorUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      audience: 'internal',
      action: 'workspace.switch',
      resourceType: 'workspace',
      resourceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      metadata: { source: 'workspace-switcher' },
      occurredAt,
    };
    const row = {
      id: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
      ...input,
    };
    const { db, insertCalls } = createDbMock([row]);
    const repository = new AuditRepository({ db } as never);

    await expect(repository.insertEvent(input)).resolves.toEqual(row);

    expect(insertCalls[0]?.table).toBe(auditEvents);
    expect(insertCalls[0]?.valuesArgs[0]).toEqual(input);
  });

  it('lists events scoped by workspace and audience before a timestamp', async () => {
    const { db, selectBuilder } = createDbMock([], []);
    const repository = new AuditRepository({ db } as never);
    const before = new Date('2026-06-30T13:00:00.000Z');
    const beforeId = '98d9e64c-7686-4e40-91ce-3f861fd169e5';

    await repository.listEvents({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      audience: 'client',
      before,
      beforeId,
      limit: 25,
    });

    expect(selectBuilder.from).toHaveBeenCalledWith(auditEvents);
    expect(selectBuilder.limit).toHaveBeenCalledWith(25);
    expect(selectBuilder.orderBy).toHaveBeenCalledTimes(1);
    expectDescendingColumn(selectBuilder.orderBy.mock.calls[0]?.[0], 'occurred_at');
    expectDescendingColumn(selectBuilder.orderBy.mock.calls[0]?.[1], 'id');

    const condition = selectBuilder.where.mock.calls[0]?.[0];
    expect(collectComparisons(condition)).toEqual([
      { columnName: 'workspace_id', operator: '=', value: '82bf0afe-b730-4046-ac0b-30f74ce1db7a' },
      { columnName: 'audience', operator: '=', value: 'client' },
      { columnName: 'occurred_at', operator: '<', value: before },
      { columnName: 'occurred_at', operator: '=', value: before },
      { columnName: 'id', operator: '<', value: beforeId },
    ]);
    expect(collectStringChunks(condition)).toEqual(expect.arrayContaining([' and ', ' or ']));
  });

  it('does not expose update or delete methods', () => {
    const { db } = createDbMock();
    const repository = new AuditRepository({ db } as never) as unknown as Record<string, unknown>;

    expect(repository.updateEvent).toBeUndefined();
    expect(repository.deleteEvent).toBeUndefined();
  });
});
