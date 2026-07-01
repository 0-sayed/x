import { describe, expect, it, vi } from 'vitest';

import { clientIdentities } from '@materiabill/db';
import { ClientIdentitiesRepository } from './client-identities.repository.js';

function createDbMock(selectRows: readonly unknown[] = [], insertRows: readonly unknown[] = []) {
  const calls: unknown[] = [];
  const selectBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(selectRows),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);

  const insertCall: { values?: unknown } = {};
  const db = {
    select: vi.fn(() => selectBuilder),
    insert: vi.fn((table: unknown) => {
      calls.push({ op: 'insert', table });
      return {
        values: vi.fn((values: unknown) => {
          insertCall.values = values;
          return {
            returning: vi.fn().mockResolvedValue(insertRows),
          };
        }),
      };
    }),
  };

  return { calls, db, insertCall, selectBuilder };
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

describe('ClientIdentitiesRepository', () => {
  it('finds identities by normalized email contact', async () => {
    const identity = { id: '11111111-1111-4111-8111-111111111111' };
    const { db, selectBuilder } = createDbMock([identity]);
    const repository = new ClientIdentitiesRepository({ db } as never);

    await expect(repository.findByEmail('client@example.com')).resolves.toEqual(identity);

    expect(selectBuilder.from).toHaveBeenCalledWith(clientIdentities);
    expect(selectBuilder.limit).toHaveBeenCalledWith(1);
    expect(collectLeaves(selectBuilder.where.mock.calls[0]?.[0])).toContain('client@example.com');
  });

  it('finds identities by exact phone contact', async () => {
    const identity = { id: '11111111-1111-4111-8111-111111111111' };
    const { db, selectBuilder } = createDbMock([identity]);
    const repository = new ClientIdentitiesRepository({ db } as never);

    await expect(repository.findByPhone('+966555123456')).resolves.toEqual(identity);

    expect(selectBuilder.from).toHaveBeenCalledWith(clientIdentities);
    expect(collectLeaves(selectBuilder.where.mock.calls[0]?.[0])).toContain('+966555123456');
  });

  it('creates identities with database contact columns', async () => {
    const created = { id: '11111111-1111-4111-8111-111111111111' };
    const { calls, db, insertCall } = createDbMock([], [created]);
    const repository = new ClientIdentitiesRepository({ db } as never);

    await expect(
      repository.createIdentity({
        displayName: 'Client One',
        email: 'client@example.com',
        verifiedEmailAt: '2026-07-02T00:00:00.000Z',
      }),
    ).resolves.toEqual(created);

    expect(calls).toEqual([expect.objectContaining({ op: 'insert', table: clientIdentities })]);
    expect(insertCall.values).toEqual({
      displayName: 'Client One',
      email: 'client@example.com',
      phoneE164: null,
      verifiedEmailAt: new Date('2026-07-02T00:00:00.000Z'),
      verifiedPhoneAt: null,
      inframodernUserId: null,
    });
  });
});
