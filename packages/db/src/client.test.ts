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

vi.mock('postgres', () => ({
  default: vi.fn(() => Object.assign(vi.fn(), { end: vi.fn(() => Promise.resolve()) })),
}));

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

describe('database client factory', () => {
  it('requires a database URL', async () => {
    const { createDatabaseClient } = await import('./client.js');

    expect(() => createDatabaseClient(undefined)).toThrow('DATABASE_URL is required');
  });

  it('creates and closes a configured Drizzle postgres client', async () => {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { default: postgres } = await import('postgres');
    const postgresClient = Object.assign(vi.fn(), { end: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(postgres).mockReturnValue(postgresClient as never);
    vi.mocked(drizzle).mockReturnValue({ mocked: true } as never);
    const { createDatabaseClient } = await import('./client.js');

    const databaseClient = createDatabaseClient('postgres://local_user:pass@127.0.0.1:55432/db');

    expect(postgres).toHaveBeenCalledWith('postgres://local_user:pass@127.0.0.1:55432/db', {
      max: 10,
    });
    expect(drizzle).toHaveBeenCalledWith(postgresClient, {
      schema: expect.any(Object),
      casing: 'snake_case',
    });
    expect(databaseClient).toEqual({
      db: { mocked: true },
      client: postgresClient,
      close: expect.any(Function),
    });

    await databaseClient.close();

    expect(postgresClient.end).toHaveBeenCalled();
  });
});
