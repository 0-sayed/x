import { describe, expect, it } from 'vitest';

import {
  syncEnvelopeSchema,
  syncPullRequestSchema,
  syncResourceSchema,
  syncRetryResponseSchema,
} from './sync.js';

describe('sync contracts', () => {
  it('accepts only T005 required sync resources', () => {
    expect(syncResourceSchema.options).toEqual(['users', 'brands', 'locations', 'exchange-rates']);
  });

  it('parses an Inframodern envelope', () => {
    expect(
      syncEnvelopeSchema.parse({
        items: [{ id: '018f3f91-1b79-71ec-9d83-000000000001' }],
        correlationId: 'corr-1',
        operationId: 'op-1',
        targetApp: 'materiabill-testing',
      }),
    ).toMatchObject({
      correlationId: 'corr-1',
      operationId: 'op-1',
    });
  });

  it('rejects empty item batches', () => {
    expect(() =>
      syncEnvelopeSchema.parse({
        items: [],
        correlationId: 'corr-1',
      }),
    ).toThrow();
  });

  it('keeps retry and pull response shapes stable', () => {
    expect(syncRetryResponseSchema.parse({ status: 'queued', failureId: 'failure-1' })).toEqual({
      status: 'queued',
      failureId: 'failure-1',
    });

    expect(syncPullRequestSchema.parse({ resources: ['users'] })).toEqual({
      resources: ['users'],
    });
  });
});
