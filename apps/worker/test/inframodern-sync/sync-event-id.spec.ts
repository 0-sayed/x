import { describe, expect, it } from 'vitest';

import { getPoisonSyncEventId, getSyncEventId } from '../../src/inframodern-sync/sync-event-id.js';

describe('sync event ids', () => {
  it('uses operationId when Inframodern supplies it', () => {
    expect(
      getSyncEventId('users', {
        items: [{ id: 'u1' }],
        correlationId: 'corr-1',
        operationId: 'op-1',
      }),
    ).toBe('op-1');
  });

  it('derives stable ids when operationId is absent', () => {
    const first = getSyncEventId('brands', {
      items: [{ id: 'b1', name: 'Brand' }],
      correlationId: 'corr-1',
    });
    const second = getSyncEventId('brands', {
      items: [{ name: 'Brand', id: 'b1' }],
      correlationId: 'corr-1',
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^derived:brands:/);
  });

  it('canonicalizes nested objects when deriving ids', () => {
    const first = getSyncEventId('locations', {
      items: [
        {
          id: 'l1',
          metadata: {
            address: { city: 'Cairo', line1: 'Road 9' },
            tags: [{ key: 'tier', value: 'hq' }],
          },
        },
      ],
      correlationId: 'corr-2',
    });
    const second = getSyncEventId('locations', {
      items: [
        {
          metadata: {
            tags: [{ value: 'hq', key: 'tier' }],
            address: { line1: 'Road 9', city: 'Cairo' },
          },
          id: 'l1',
        },
      ],
      correlationId: 'corr-2',
    });

    expect(first).toBe(second);
  });

  it('derives stable poison ids from resource and raw message', () => {
    const first = getPoisonSyncEventId('users', '{"broken":');
    const second = getPoisonSyncEventId('users', '{"broken":');

    expect(first).toBe(second);
    expect(first).toMatch(/^poison:users:/);
  });
});
