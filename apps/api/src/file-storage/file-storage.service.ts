import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  fileUploadPurposeSchema,
  type UploadedFileAsset,
  type WorkspaceContext,
} from '@materiabill/contracts';
import { createHash, randomUUID } from 'node:crypto';

import type { FileStorageAdapter } from './file-storage.types.js';
import { FileStorageRepository } from './file-storage.repository.js';

type FileStorageServiceOptions = {
  readonly allowedMimeTypes: readonly string[];
  readonly maxBytes: number;
  readonly idFactory?: () => string;
};

type UploadedFile = {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
};

export type UploadFileInput = {
  readonly workspaceContext: WorkspaceContext;
  readonly purpose: unknown;
  readonly file: UploadedFile | undefined;
};

@Injectable()
export class FileStorageService {
  readonly #idFactory: () => string;

  constructor(
    private readonly repository: FileStorageRepository,
    private readonly adapter: FileStorageAdapter,
    private readonly options: FileStorageServiceOptions,
  ) {
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async upload(input: UploadFileInput): Promise<UploadedFileAsset> {
    const purposeResult = fileUploadPurposeSchema.safeParse(input.purpose);
    if (!purposeResult.success) {
      throw new BadRequestException('Invalid file upload purpose');
    }

    if (!input.file?.buffer) {
      throw new BadRequestException('Invalid file upload');
    }

    if (input.file.size > this.options.maxBytes) {
      throw new PayloadTooLargeException('File exceeds configured size limit');
    }

    if (!this.options.allowedMimeTypes.includes(input.file.mimetype)) {
      throw new BadRequestException('File type is not allowed');
    }

    const id = this.#idFactory();
    const checksumSha256 = createHash('sha256').update(input.file.buffer).digest('hex');
    const originalFilename = input.file.originalname || 'upload';
    const key = buildStorageKey(input.workspaceContext.workspace.id, id, originalFilename);

    let stored: Awaited<ReturnType<FileStorageAdapter['putObject']>>;
    try {
      stored = await this.adapter.putObject({
        key,
        body: input.file.buffer,
        contentType: input.file.mimetype,
        originalFilename,
        checksumSha256,
      });
    } catch {
      throw new ServiceUnavailableException('File storage unavailable');
    }

    return this.repository.createAsset({
      id,
      workspaceId: input.workspaceContext.workspace.id,
      uploadedByUserId: input.workspaceContext.membership.userId,
      purpose: purposeResult.data,
      storageProvider: stored.provider,
      storageKey: stored.key,
      originalFilename,
      contentType: input.file.mimetype,
      sizeBytes: input.file.size,
      checksumSha256,
    });
  }
}

function buildStorageKey(workspaceId: string, assetId: string, originalFilename: string): string {
  return `workspaces/${workspaceId}/uploads/${assetId}/${sanitizeFilename(originalFilename)}`;
}

function sanitizeFilename(filename: string): string {
  const trimmed = filename.trim().toLowerCase();
  const sanitized = trimmed
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'upload';
  }

  return sanitized;
}
