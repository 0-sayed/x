import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { fileAssets } from './file-assets.js';

describe('file asset schema', () => {
  it('uses the stable file_assets table name', () => {
    expect(getTableName(fileAssets)).toBe('file_assets');
  });

  it('keeps file asset columns explicit', () => {
    expect(Object.keys(getTableColumns(fileAssets))).toEqual([
      'id',
      'workspaceId',
      'uploadedByUserId',
      'purpose',
      'storageProvider',
      'storageKey',
      'originalFilename',
      'contentType',
      'sizeBytes',
      'checksumSha256',
      'status',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('stores file sizes in a 64-bit column', () => {
    expect(getTableColumns(fileAssets).sizeBytes.getSQLType()).toBe('bigint');
  });

  it('adds lookup indexes used by workspace-scoped uploads', () => {
    expect(
      getTableConfig(fileAssets)
        .indexes.map((index) => index.config.name)
        .sort(),
    ).toEqual([
      'file_assets_checksum_sha256_idx',
      'file_assets_uploaded_by_user_id_idx',
      'file_assets_workspace_id_idx',
      'file_assets_workspace_purpose_created_at_idx',
    ]);
  });
});
