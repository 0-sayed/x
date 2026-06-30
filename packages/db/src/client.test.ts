import { describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';

import * as schema from './schema/index.js';
import { getDbClient } from './client.js';

const { drizzleSpy, mockedDb } = vi.hoisted(() => ({
  drizzleSpy: vi.fn(),
  mockedDb: { __brand: 'drizzle-db' },
}));

vi.mock('drizzle-orm/postgres-js', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm/postgres-js')>('drizzle-orm/postgres-js');

  return {
    ...actual,
    drizzle: drizzleSpy,
  };
});

describe('db client', () => {
  it('requires DATABASE_URL before creating a client', () => {
    expect(() => getDbClient({ databaseUrl: undefined })).toThrow('DATABASE_URL is required');
  });

  it('builds a drizzle database for the injected sql client', () => {
    const end = vi.fn(() => Promise.resolve());
    const sql = Object.assign(vi.fn(), { end }) as unknown as Sql;
    drizzleSpy.mockReturnValueOnce(mockedDb);

    const client = getDbClient(
      { databaseUrl: 'postgresql://local_user:local_pass@127.0.0.1:55432/materiabill' },
      {
        createSql: (url) => {
          expect(url).toBe('postgresql://local_user:local_pass@127.0.0.1:55432/materiabill');

          return sql;
        },
      },
    );

    expect(drizzleSpy).toHaveBeenCalledWith(sql, { schema, casing: 'snake_case' });
    expect(client.db).toBe(mockedDb);
  });

  it('closes the underlying postgres connection', async () => {
    const end = vi.fn(() => Promise.resolve());
    const sql = Object.assign(vi.fn(), { end }) as unknown as Sql;
    drizzleSpy.mockReturnValueOnce(mockedDb);
    const client = getDbClient(
      { databaseUrl: 'postgresql://local_user:local_pass@127.0.0.1:55432/materiabill' },
      { createSql: () => sql },
    );

    await client.close();

    expect(end).toHaveBeenCalledTimes(1);
  });
});
