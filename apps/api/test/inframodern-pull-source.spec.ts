import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InframodernPullSource } from '../src/sync-admin/inframodern-pull-source.js';

const postgresMock = vi.hoisted(() => {
  const sql = vi.fn();
  const connect = vi.fn(() => Object.assign(sql, { end: vi.fn(() => Promise.resolve()) }));
  return { connect, sql };
});

vi.mock('postgres', () => ({ default: postgresMock.connect }));

describe('InframodernPullSource', () => {
  beforeEach(() => {
    postgresMock.connect.mockClear();
    postgresMock.sql.mockReset();
  });

  it('reads large source tables in chunks and returns one envelope per chunk', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      id: `user-${String(index + 1)}`,
    }));
    postgresMock.sql.mockImplementation((_strings: TemplateStringsArray, ...values: unknown[]) => {
      const lastId = typeof values[0] === 'string' ? values[0] : undefined;
      const limitValue = values.at(-1);
      const limit = typeof limitValue === 'number' ? limitValue : undefined;

      if (limit === undefined) {
        return Promise.resolve(rows);
      }

      const start = lastId ? rows.findIndex((row) => row.id === lastId) + 1 : 0;
      return Promise.resolve(rows.slice(start, start + limit));
    });

    const batches = await new InframodernPullSource().readBatches('postgres://source', ['users']);

    expect(batches).toHaveLength(2);
    expect(batches.map((batch) => batch.envelope.items)).toEqual([
      rows.slice(0, 1000),
      rows.slice(1000),
    ]);
    expect(postgresMock.sql).toHaveBeenCalledTimes(2);
    expect(postgresMock.sql.mock.calls.map(([, ...values]) => values)).toEqual([
      [1000],
      ['user-1000', 1000],
    ]);
  });
});
