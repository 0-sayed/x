import { describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

vi.mock('postgres', () => ({
  default: vi.fn(() => ({ end: vi.fn() })),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({ mocked: true })),
}));

describe('database client factory', () => {
  it('requires a database URL', async () => {
    const { createDatabaseClient } = await import('./client.js');

    expect(() => createDatabaseClient(undefined)).toThrow('DATABASE_URL is required');
  });

  it('creates and closes a configured Drizzle postgres client', async () => {
    const postgresClient = { end: vi.fn().mockResolvedValue(undefined) };
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
