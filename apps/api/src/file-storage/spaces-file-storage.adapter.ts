import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { FileStorageRuntimeConfig } from '@materiabill/config';

import type { FileStorageAdapter, StoreFileInput, StoredFile } from './file-storage.types.js';

type SpacesClientLike = Pick<S3Client, 'send'>;

type SpacesFileStorageAdapterConfig = Extract<FileStorageRuntimeConfig, { driver: 'spaces' }> & {
  readonly client?: SpacesClientLike;
};

export class SpacesFileStorageAdapter implements FileStorageAdapter {
  readonly #bucket: string;
  readonly #client: SpacesClientLike;

  constructor(config: SpacesFileStorageAdapterConfig) {
    this.#bucket = config.bucket;
    this.#client =
      config.client ??
      new S3Client({
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
  }

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: {
          checksumSha256: input.checksumSha256,
          originalFilename: input.originalFilename,
        },
      }),
    );

    return {
      provider: 'spaces',
      key: input.key,
    };
  }
}
