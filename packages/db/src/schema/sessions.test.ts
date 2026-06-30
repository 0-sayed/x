import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { sessionRecords } from './sessions.js';

describe('session schema', () => {
  it('uses the stable session_records table name', () => {
    expect(getTableName(sessionRecords)).toBe('session_records');
  });

  it('keeps session record columns explicit', () => {
    expect(Object.keys(getTableColumns(sessionRecords))).toEqual([
      'id',
      'userId',
      'activeWorkspaceId',
      'encryptedTokens',
      'accessTokenExpiresAt',
      'refreshTokenExpiresAt',
      'expiresAt',
      'createdAt',
      'updatedAt',
      'revokedAt',
    ]);
  });

  it('adds lookup indexes used by the session module', () => {
    expect(
      getTableConfig(sessionRecords)
        .indexes.map((index) => index.config.name)
        .sort(),
    ).toEqual([
      'session_records_expires_at_idx',
      'session_records_revoked_at_idx',
      'session_records_user_id_idx',
    ]);
  });
});
