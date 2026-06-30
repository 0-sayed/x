import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path';

import type { FileStorageRuntimeConfig } from '@materiabill/config';

import type { FileStorageAdapter, StoreFileInput, StoredFile } from './file-storage.types.js';

type LocalFileStorageAdapterConfig = Extract<FileStorageRuntimeConfig, { driver: 'local' }>;

export class LocalFileStorageAdapter implements FileStorageAdapter {
  readonly #root: string;

  constructor(config: LocalFileStorageAdapterConfig) {
    this.#root = resolve(config.localRoot);
  }

  async putObject(input: StoreFileInput): Promise<StoredFile> {
    if (isUnsafeLocalStorageKey(input.key)) {
      throw new Error('Invalid local storage key');
    }

    const targetPath = resolve(this.#root, input.key);

    if (targetPath !== this.#root && !targetPath.startsWith(`${this.#root}${sep}`)) {
      throw new Error('Invalid local storage key');
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, input.body);

    return {
      provider: 'local',
      key: input.key,
    };
  }
}

function isUnsafeLocalStorageKey(key: string): boolean {
  return (
    isAbsolute(key) ||
    normalize(key) !== key ||
    key.split(/[\\/]+/).some((segment) => segment === '.' || segment === '..')
  );
}
