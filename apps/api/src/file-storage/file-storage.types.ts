import type { UploadedFileAsset } from '@materiabill/contracts';

export const FILE_STORAGE_ADAPTER = Symbol('FILE_STORAGE_ADAPTER');

type StorageProvider = 'local' | 'spaces';

export type StoreFileInput = {
  readonly key: string;
  readonly body: Buffer;
  readonly contentType: string;
  readonly originalFilename: string;
  readonly checksumSha256: string;
};

export type StoredFile = {
  readonly provider: StorageProvider;
  readonly key: string;
};

export type FileStorageAdapter = {
  putObject(input: StoreFileInput): Promise<StoredFile>;
};

export type CreateFileAssetInput = {
  readonly id: string;
  readonly workspaceId: string;
  readonly uploadedByUserId: string;
  readonly purpose: UploadedFileAsset['purpose'];
  readonly storageProvider: StorageProvider;
  readonly storageKey: string;
  readonly originalFilename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
};
