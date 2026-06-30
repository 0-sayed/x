import { FileInterceptor } from '@nestjs/platform-express';
import {
  Body,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import type {
  UploadedFileAsset,
  WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';
import { getFileStorageRuntimeConfig } from '@materiabill/config';
import { memoryStorage } from 'multer';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { FileStorageService } from './file-storage.service.js';

const fileUploadMaxBytes = getFileStorageRuntimeConfig(process.env).maxBytes;

@Controller('files')
export class FileStorageController {
  constructor(
    @Inject(FileStorageService) private readonly fileStorageService: FileStorageService,
  ) {}

  @Post()
  @UseGuards(WorkspaceContextGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: fileUploadMaxBytes },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['purpose', 'file'],
      properties: {
        purpose: {
          type: 'string',
          enum: ['generic', 'document', 'site_photo', 'logo'],
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  upload(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Body('purpose') purpose: unknown,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadedFileAsset> {
    return this.fileStorageService.upload({
      workspaceContext,
      purpose,
      file,
    });
  }
}
