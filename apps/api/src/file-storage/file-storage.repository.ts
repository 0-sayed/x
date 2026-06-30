import { Inject, Injectable } from '@nestjs/common';
import type { UploadedFileAsset } from '@materiabill/contracts';
import { fileAssets, type DatabaseClient } from '@materiabill/db';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type { CreateFileAssetInput } from './file-storage.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class FileStorageRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async createAsset(input: CreateFileAssetInput): Promise<UploadedFileAsset> {
    const rows = await this.#db
      .insert(fileAssets)
      .values({ ...input, status: 'uploaded' })
      .returning({
        id: fileAssets.id,
        workspaceId: fileAssets.workspaceId,
        purpose: fileAssets.purpose,
        originalFilename: fileAssets.originalFilename,
        contentType: fileAssets.contentType,
        sizeBytes: fileAssets.sizeBytes,
        checksumSha256: fileAssets.checksumSha256,
        createdAt: fileAssets.createdAt,
      });

    const row = rows[0];
    if (!row) {
      throw new Error('File asset was not created');
    }

    return {
      ...row,
      purpose: row.purpose as UploadedFileAsset['purpose'],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
