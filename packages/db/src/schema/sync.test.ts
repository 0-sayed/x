import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
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

  it('updates checkpoint timestamps when rows change', () => {
    expect(syncCheckpoints.updatedAt.onUpdateFn).toEqual(expect.any(Function));
  });

  it('does not require operation ids to be globally unique inbox identifiers', () => {
    const inboxIndexes = getTableConfig(syncInbox).indexes.map((index) => index.config);

    expect(inboxIndexes).toEqual([
      expect.objectContaining({
        name: 'sync_inbox_resource_received_at_idx',
        unique: false,
      }),
    ]);
  });
});
