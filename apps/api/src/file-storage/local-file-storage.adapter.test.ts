import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FileStorageRuntimeConfig } from '@materiabill/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalFileStorageAdapter } from './local-file-storage.adapter.js';

type Expect<T extends true> = T;
type LocalFileStorageRuntimeConfig = Extract<FileStorageRuntimeConfig, { driver: 'local' }>;
type LocalAdapterUsesSharedConfig = Expect<
  ConstructorParameters<typeof LocalFileStorageAdapter>[0] extends LocalFileStorageRuntimeConfig
    ? true
    : false
>;
const localAdapterUsesSharedConfig: LocalAdapterUsesSharedConfig = true;

describe('LocalFileStorageAdapter', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'materiabill-files-'));
  });

  it('uses the shared local storage runtime config shape', () => {
    expect(localAdapterUsesSharedConfig).toBe(true);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('writes uploaded bytes below the configured local root', async () => {
    const adapter = new LocalFileStorageAdapter({
      driver: 'local',
      localRoot: root,
      maxBytes: 10_485_760,
      allowedMimeTypes: ['image/jpeg'],
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
      provider: 'local',
      key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
    });

    await expect(
      readFile(
        join(
          root,
          'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress.jpg',
        ),
        'utf8',
      ),
    ).resolves.toBe('image-bytes');
  });

  it('rejects keys that escape the configured local root', async () => {
    const adapter = new LocalFileStorageAdapter({
      driver: 'local',
      localRoot: root,
      maxBytes: 10_485_760,
      allowedMimeTypes: ['text/plain'],
    });

    await expect(
      adapter.putObject({
        key: '../escape.txt',
        body: Buffer.from('bad'),
        contentType: 'text/plain',
        originalFilename: 'escape.txt',
        checksumSha256: 'b'.repeat(64),
      }),
    ).rejects.toThrow('Invalid local storage key');
  });

  it('rejects absolute paths', async () => {
    const adapter = new LocalFileStorageAdapter({
      driver: 'local',
      localRoot: root,
      maxBytes: 10_485_760,
      allowedMimeTypes: ['text/plain'],
    });

    await expect(
      adapter.putObject({
        key: '/tmp/escape.txt',
        body: Buffer.from('bad'),
        contentType: 'text/plain',
        originalFilename: 'escape.txt',
        checksumSha256: 'c'.repeat(64),
      }),
    ).rejects.toThrow('Invalid local storage key');
  });

  it('rejects backslash-delimited keys instead of treating them as storage paths', async () => {
    const adapter = new LocalFileStorageAdapter({
      driver: 'local',
      localRoot: root,
      maxBytes: 10_485_760,
      allowedMimeTypes: ['text/plain'],
    });

    await expect(
      adapter.putObject({
        key: 'workspaces\\82bf0afe-b730-4046-ac0b-30f74ce1db7a\\uploads\\01890f8e-5f47-7cc3-98c4-dc0c0c07398f\\progress.txt',
        body: Buffer.from('bad'),
        contentType: 'text/plain',
        originalFilename: 'progress.txt',
        checksumSha256: 'e'.repeat(64),
      }),
    ).rejects.toThrow('Invalid local storage key');
  });

  it('rejects keys that normalize to a different local path', async () => {
    const adapter = new LocalFileStorageAdapter({
      driver: 'local',
      localRoot: root,
      maxBytes: 10_485_760,
      allowedMimeTypes: ['text/plain'],
    });

    await expect(
      adapter.putObject({
        key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/../escape.txt',
        body: Buffer.from('bad'),
        contentType: 'text/plain',
        originalFilename: 'escape.txt',
        checksumSha256: 'd'.repeat(64),
      }),
    ).rejects.toThrow('Invalid local storage key');
  });

  it('rejects delete keys that traverse a symlinked directory outside the local root', async () => {
    const externalRoot = await mkdtemp(join(tmpdir(), 'materiabill-external-files-'));

    try {
      const adapter = new LocalFileStorageAdapter({
        driver: 'local',
        localRoot: root,
        maxBytes: 10_485_760,
        allowedMimeTypes: ['text/plain'],
      });
      const externalPath = join(externalRoot, 'victim.txt');

      await writeFile(externalPath, 'keep-me');
      await symlink(externalRoot, join(root, 'linked'), 'dir');

      await expect(adapter.deleteObject({ key: 'linked/victim.txt' })).rejects.toThrow(
        'Invalid local storage key',
      );
      await expect(readFile(externalPath, 'utf8')).resolves.toBe('keep-me');
    } finally {
      await rm(externalRoot, { force: true, recursive: true });
    }
  });
});
