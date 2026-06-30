import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { FileStorageRuntimeConfig } from '@materiabill/config';
import { describe, expect, it, vi } from 'vitest';

import { SpacesFileStorageAdapter } from './spaces-file-storage.adapter.js';

type Expect<T extends true> = T;
type SpacesFileStorageRuntimeConfig = Extract<FileStorageRuntimeConfig, { driver: 'spaces' }>;
type SpacesAdapterConfig = ConstructorParameters<typeof SpacesFileStorageAdapter>[0];
type SpacesAdapterUsesSharedConfig = Expect<
  Omit<SpacesAdapterConfig, 'client'> extends SpacesFileStorageRuntimeConfig ? true : false
>;
const spacesAdapterUsesSharedConfig: SpacesAdapterUsesSharedConfig = true;

describe('SpacesFileStorageAdapter', () => {
  it('uses the shared Spaces storage runtime config shape', () => {
    expect(spacesAdapterUsesSharedConfig).toBe(true);
  });

  it('uploads objects with private metadata to the configured bucket', async () => {
    const send = vi.fn().mockResolvedValue({});
    const adapter = new SpacesFileStorageAdapter({
      driver: 'spaces',
      bucket: 'materiabill-local',
      endpoint: 'https://nyc3.digitaloceanspaces.com',
      forcePathStyle: false,
      region: 'nyc3',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      maxBytes: 10_485_760,
      allowedMimeTypes: ['image/jpeg'],
      client: { send },
    });

    await expect(
      adapter.putObject({
        key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
        body: Buffer.from('image-bytes'),
        contentType: 'image/jpeg',
        originalFilename: 'progress.jpg',
        checksumSha256: 'a'.repeat(64),
      }),
    ).resolves.toEqual({
      provider: 'spaces',
      key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'materiabill-local',
      Key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
      Body: Buffer.from('image-bytes'),
      ContentType: 'image/jpeg',
      Metadata: {
        checksumSha256: 'a'.repeat(64),
        originalFilename: 'progress.jpg',
      },
    });
  });
});
