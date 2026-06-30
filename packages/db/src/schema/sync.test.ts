import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { syncCheckpoints, syncFailures, syncInbox } from './sync.js';

describe('sync schema', () => {
  it('uses stable sync infrastructure table names', () => {
    expect(getTableName(syncInbox)).toBe('sync_inbox');
    expect(getTableName(syncFailures)).toBe('sync_failures');
    expect(getTableName(syncCheckpoints)).toBe('sync_checkpoints');
  });

  it('keeps the inbox event ledger columns explicit', () => {
    expect(Object.keys(getTableColumns(syncInbox))).toEqual([
      'eventId',
      'resource',
      'correlationId',
      'operationId',
      'jobId',
      'targetApp',
      'payload',
      'receivedAt',
      'processedAt',
    ]);
  });

  it('keeps the failure ledger columns explicit', () => {
    expect(Object.keys(getTableColumns(syncFailures))).toEqual([
      'id',
      'eventId',
      'resource',
      'correlationId',
      'operationId',
      'jobId',
      'payload',
      'errorMessage',
      'errorStack',
      'retryCount',
      'failedAt',
      'resolvedAt',
    ]);
  });

  it('keeps checkpoint storage resource-keyed', () => {
    expect(Object.keys(getTableColumns(syncCheckpoints))).toEqual([
      'resource',
      'cursor',
      'lastEventId',
      'lastSyncedAt',
      'updatedAt',
    ]);
  });
});
