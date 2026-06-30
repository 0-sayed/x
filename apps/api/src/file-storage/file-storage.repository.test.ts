import { uploadedFileAssetSchema } from '@materiabill/contracts';
import { fileAssets } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { FileStorageRepository } from './file-storage.repository.js';

function createDbMock(insertRows: readonly unknown[] = []) {
  const insertCalls: { table: unknown; valuesArgs: unknown[] }[] = [];
  const db = {
    insert: vi.fn((table: unknown) => {
      const call = { table, valuesArgs: [] };
      insertCalls.push(call);

      return {
        values: vi.fn((values: unknown) => {
          call.valuesArgs.push(values as never);

          return {
            returning: vi.fn((projection?: Record<string, unknown>) =>
              Promise.resolve(
                projection
                  ? insertRows.map((row) =>
                      Object.fromEntries(
                        Object.keys(projection).map((key) => [
                          key,
                          (row as Record<string, unknown>)[key],
                        ]),
                      ),
                    )
                  : insertRows,
              ),
            ),
          };
        }),
      };
    }),
  };

  return { db, insertCalls };
}

describe('FileStorageRepository', () => {
  it('persists uploaded file metadata and returns the public asset response', async () => {
    const { db, insertCalls } = createDbMock([
      {
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        uploadedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        purpose: 'site_photo',
        storageProvider: 'local',
        storageKey:
          'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
        originalFilename: 'progress.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        checksumSha256: 'a'.repeat(64),
        status: 'uploaded',
        createdAt: new Date('2026-06-30T12:00:00.000Z'),
        updatedAt: new Date('2026-06-30T12:00:01.000Z'),
        deletedAt: null,
      },
    ]);
    const repository = new FileStorageRepository({ db } as never);

    const result = await repository.createAsset({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      uploadedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      purpose: 'site_photo',
      storageProvider: 'local',
      storageKey:
        'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
    });

    expect(uploadedFileAssetSchema.parse(result)).toEqual({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      purpose: 'site_photo',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      createdAt: '2026-06-30T12:00:00.000Z',
    });
    expect(result).not.toHaveProperty('uploadedByUserId');
    expect(result).not.toHaveProperty('storageProvider');
    expect(result).not.toHaveProperty('storageKey');
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('deletedAt');

    expect(insertCalls[0]?.table).toBe(fileAssets);
    expect(insertCalls[0]?.valuesArgs[0]).toMatchObject({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      uploadedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      purpose: 'site_photo',
      storageProvider: 'local',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      status: 'uploaded',
    });
  });
});
