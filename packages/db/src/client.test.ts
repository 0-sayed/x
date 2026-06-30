import { describe, expect, it, vi } from 'vitest';

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
});
