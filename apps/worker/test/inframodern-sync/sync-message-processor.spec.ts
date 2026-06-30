import { describe, expect, it, vi } from 'vitest';

import { SyncMessageProcessorService } from '../../src/inframodern-sync/sync-message-processor.service.js';

type InboxRow = {
  eventId: string;
  processedAt: Date | null;
};

function getTableName(table: object): string | undefined {
  const tableName = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
  return typeof tableName === 'string' ? tableName : undefined;
}

function createDbMock(options?: { existingInbox?: InboxRow | null }) {
  const state = {
    existingInbox: options?.existingInbox ?? null,
    insertedInbox: [] as Record<string, unknown>[],
    insertedFailures: [] as Record<string, unknown>[],
    insertedCheckpoints: [] as Record<string, unknown>[],
    updatedInbox: [] as Record<string, unknown>[],
    updatedFailures: [] as Record<string, unknown>[],
  };

  const db = {
    query: {
      syncInbox: {
        findFirst: vi.fn(() => Promise.resolve(state.existingInbox)),
      },
    },
    insert: vi.fn((table: object) => ({
      values: (value: Record<string, unknown>) => ({
        onConflictDoNothing: vi.fn(() => {
          if (getTableName(table) === 'sync_inbox') {
            state.insertedInbox.push(value);
            state.existingInbox = { eventId: String(value.eventId), processedAt: null };
          }
          return Promise.resolve();
        }),
        onConflictDoUpdate: vi.fn(
          (config: {
            set:
              | Record<string, unknown>
              | ((current: Record<string, unknown>) => Record<string, unknown>);
          }) => {
            if (getTableName(table) === 'sync_failures') {
              state.insertedFailures.push(value);
            }
            if (getTableName(table) === 'sync_checkpoints') {
              state.insertedCheckpoints.push(value);
            }
            return Promise.resolve(config);
          },
        ),
      }),
    })),
    update: vi.fn((table: object) => ({
      set: (value: Record<string, unknown>) => ({
        where: vi.fn(() => {
          if (getTableName(table) === 'sync_inbox') {
            state.updatedInbox.push(value);
            if (state.existingInbox) {
              const processedAt = value.processedAt;
              state.existingInbox = {
                ...state.existingInbox,
                processedAt: processedAt instanceof Date ? processedAt : null,
              };
            }
          }
          if (getTableName(table) === 'sync_failures') {
            state.updatedFailures.push(value);
          }
          return Promise.resolve();
        }),
      }),
    })),
  };

  return Object.assign(db, state);
}

describe('SyncMessageProcessorService', () => {
  it('skips already processed inbox events', async () => {
    const db = createDbMock({
      existingInbox: { eventId: 'op-1', processedAt: new Date('2026-06-30T10:00:00.000Z') },
    });
    const projection = { upsert: vi.fn() };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    const envelope = {
      items: [{ id: 'u1', email: 'u@example.com' }],
      correlationId: 'corr-1',
      operationId: 'op-1',
    };

    await expect(processor.processMessage('users', JSON.stringify(envelope))).resolves.toEqual({
      status: 'skipped',
      eventId: 'op-1',
      envelope,
    });

    expect(projection.upsert).not.toHaveBeenCalled();
  });

  it('retries duplicate unprocessed inbox events through projection writes', async () => {
    const db = createDbMock({
      existingInbox: { eventId: 'op-dup', processedAt: null },
    });
    const projection = { upsert: vi.fn(() => Promise.resolve(1)) };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    await expect(
      processor.processMessage(
        'brands',
        JSON.stringify({
          items: [{ id: 'b1', name: 'Brand' }],
          correlationId: 'corr-1',
          operationId: 'op-dup',
        }),
      ),
    ).resolves.toMatchObject({ status: 'processed', eventId: 'op-dup' });

    expect(projection.upsert).toHaveBeenCalledWith('brands', [{ id: 'b1', name: 'Brand' }]);
    expect(db.updatedInbox).toHaveLength(1);
    expect(db.insertedCheckpoints[0]).toMatchObject({ resource: 'brands', lastEventId: 'op-dup' });
  });

  it('records failures and returns failed outcome', async () => {
    const db = createDbMock();
    const projection = { upsert: vi.fn(() => Promise.reject(new Error('write failed'))) };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    await expect(
      processor.processMessage(
        'brands',
        JSON.stringify({
          items: [{ id: 'b1', name: 'Brand' }],
          correlationId: 'corr-1',
          operationId: 'op-2',
        }),
      ),
    ).resolves.toEqual({ status: 'failed', eventId: 'op-2' });

    expect(db.insertedFailures[0]).toMatchObject({
      eventId: 'op-2',
      resource: 'brands',
      errorMessage: 'write failed',
    });
  });

  it('records malformed JSON as a poison failure without touching projections', async () => {
    const db = createDbMock();
    const projection = { upsert: vi.fn() };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    await expect(processor.processMessage('users', '{"items":')).resolves.toMatchObject({
      status: 'failed',
      eventId: expect.stringMatching(/^poison:users:/),
    });

    expect(projection.upsert).not.toHaveBeenCalled();
    expect(db.insertedInbox[0]).toMatchObject({
      resource: 'users',
      correlationId: 'unknown',
      payload: {
        correlationId: 'unknown',
        items: [{ rawMessage: '{"items":' }],
      },
    });
    expect(db.insertedFailures[0]).toMatchObject({
      resource: 'users',
      correlationId: 'unknown',
      errorMessage: expect.stringContaining('JSON'),
      payload: {
        correlationId: 'unknown',
        items: [{ rawMessage: '{"items":' }],
      },
    });
  });

  it('records invalid envelopes as poison failures without touching projections', async () => {
    const db = createDbMock();
    const projection = { upsert: vi.fn() };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    await expect(
      processor.processMessage(
        'exchange-rates',
        JSON.stringify({
          items: [],
          correlationId: '',
        }),
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      eventId: expect.stringMatching(/^poison:exchange-rates:/),
    });

    expect(projection.upsert).not.toHaveBeenCalled();
    expect(db.insertedFailures[0]).toMatchObject({
      resource: 'exchange-rates',
      correlationId: 'unknown',
      errorMessage: expect.stringContaining('correlationId'),
      payload: {
        correlationId: 'unknown',
        items: [
          {
            rawMessage: JSON.stringify({
              items: [],
              correlationId: '',
            }),
          },
        ],
      },
    });
  });

  it('marks related failures resolved after a successful retry', async () => {
    const db = createDbMock({
      existingInbox: { eventId: 'op-3', processedAt: null },
    });
    const projection = { upsert: vi.fn(() => Promise.resolve(1)) };
    const processor = new SyncMessageProcessorService(db as never, projection as never);

    await expect(
      processor.processMessage(
        'locations',
        JSON.stringify({
          items: [{ id: 'l1', name: 'HQ' }],
          correlationId: 'corr-2',
          operationId: 'op-3',
        }),
      ),
    ).resolves.toMatchObject({ status: 'processed', eventId: 'op-3' });

    expect(db.updatedFailures[0]).toMatchObject({
      resolvedAt: expect.any(Date),
    });
  });
});
