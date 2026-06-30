import {
  BadRequestException,
  Injectable,
  Logger,
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
  readonly #logger = new Logger(FileStorageService.name);
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

    const fileSize = input.file.buffer.length;
    if (fileSize > this.options.maxBytes) {
      throw new PayloadTooLargeException('File exceeds configured size limit');
    }

    const contentType = input.file.mimetype.toLowerCase();
    if (!this.options.allowedMimeTypes.includes(contentType)) {
      throw new BadRequestException('File type is not allowed');
    }

    if (detectMimeType(input.file.buffer) !== contentType) {
      throw new BadRequestException('File contents do not match declared type');
    }

    const id = this.#idFactory();
    const checksumSha256 = createHash('sha256').update(input.file.buffer).digest('hex');
    const originalFilename = input.file.originalname.trim() || 'upload';
    const key = buildStorageKey(input.workspaceContext.workspace.id, id, originalFilename);

    let stored: Awaited<ReturnType<FileStorageAdapter['putObject']>>;
    try {
      stored = await this.adapter.putObject({
        key,
        body: input.file.buffer,
        contentType,
        originalFilename,
        checksumSha256,
      });
    } catch (error) {
      this.#logger.error(`Failed to upload file asset ${id} to storage adapter`, error);
      throw new ServiceUnavailableException('File storage unavailable');
    }

    try {
      return await this.repository.createAsset({
        id,
        workspaceId: input.workspaceContext.workspace.id,
        uploadedByUserId: input.workspaceContext.membership.userId,
        purpose: purposeResult.data,
        storageProvider: stored.provider,
        storageKey: stored.key,
        originalFilename,
        contentType,
        sizeBytes: fileSize,
        checksumSha256,
      });
    } catch (error) {
      try {
        await this.adapter.deleteObject({ key: stored.key });
      } catch (cleanupError) {
        this.#logger.error(
          `Failed to delete orphaned file asset ${id} from storage adapter`,
          cleanupError,
        );
      }

      throw error;
    }
  }
}

function detectMimeType(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  const prefix = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (prefix.startsWith('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) {
    return 'image/svg+xml';
  }

  return undefined;
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
