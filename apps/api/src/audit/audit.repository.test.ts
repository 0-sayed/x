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

    await repository.listEvents({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      audience: 'client',
      before: new Date('2026-06-30T13:00:00.000Z'),
      limit: 25,
    });

    expect(selectBuilder.from).toHaveBeenCalledWith(auditEvents);
    expect(selectBuilder.limit).toHaveBeenCalledWith(25);
    expect(selectBuilder.orderBy).toHaveBeenCalledTimes(1);
    expect(selectBuilder.orderBy.mock.calls[0]?.[0]).toMatchObject({
      queryChunks: expect.arrayContaining([
        expect.objectContaining({ name: 'occurred_at' }),
        expect.objectContaining({ value: [' desc'] }),
      ]),
    });
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain('82bf0afe-b730-4046-ac0b-30f74ce1db7a');
    expect(conditionLeaves).toContain('client');
    expect(conditionLeaves).toContain('2026-06-30T13:00:00.000Z');
  });

  it('does not expose update or delete methods', () => {
    const { db } = createDbMock();
    const repository = new AuditRepository({ db } as never) as unknown as Record<string, unknown>;

    expect(repository.updateEvent).toBeUndefined();
    expect(repository.deleteEvent).toBeUndefined();
  });
});
