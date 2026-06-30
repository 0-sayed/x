import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, posix, resolve, sep, win32 } from 'node:path';

import type { FileStorageRuntimeConfig } from '@materiabill/config';

import type { FileStorageAdapter, StoreFileInput, StoredFile } from './file-storage.types.js';

type LocalFileStorageAdapterConfig = Extract<FileStorageRuntimeConfig, { driver: 'local' }>;

export class LocalFileStorageAdapter implements FileStorageAdapter {
  readonly #root: string;

  constructor(config: LocalFileStorageAdapterConfig) {
    this.#root = resolve(config.localRoot);
  }

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    const targetPath = resolveLocalStoragePath(this.#root, input.key);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.body);

    return {
      provider: 'local',
      key: input.key,
    };
  }

  async deleteObject(input: { readonly key: string }): Promise<void> {
    await rm(resolveLocalStoragePath(this.#root, input.key), { force: true });
  }
}

function isUnsafeLocalStorageKey(key: string): boolean {
  return (
    key.length === 0 ||
    key.includes('\\') ||
    isAbsolute(key) ||
    win32.isAbsolute(key) ||
    posix.normalize(key) !== key ||
    key.split('/').some((segment) => segment === '.' || segment === '..')
  );
}

function resolveLocalStoragePath(root: string, key: string): string {
  if (isUnsafeLocalStorageKey(key)) {
    throw new Error('Invalid local storage key');
  }

  const targetPath = resolve(root, key);

  if (targetPath !== root && !targetPath.startsWith(`${root}${sep}`)) {
    throw new Error('Invalid local storage key');
  }

  return targetPath;
}
