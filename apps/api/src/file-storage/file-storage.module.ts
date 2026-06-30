import { Module } from '@nestjs/common';
import { getFileStorageRuntimeConfig } from '@materiabill/config';

import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { FileStorageController } from './file-storage.controller.js';
import { LocalFileStorageAdapter } from './local-file-storage.adapter.js';
import { FileStorageRepository } from './file-storage.repository.js';
import { FileStorageService } from './file-storage.service.js';
import { SpacesFileStorageAdapter } from './spaces-file-storage.adapter.js';
import { FILE_STORAGE_ADAPTER, type FileStorageAdapter } from './file-storage.types.js';

@Module({
  imports: [SessionModule, WorkspaceContextModule],
  controllers: [FileStorageController],
  providers: [
    FileStorageRepository,
    {
      provide: FILE_STORAGE_ADAPTER,
      useFactory: () => {
        const config = getFileStorageRuntimeConfig(process.env);

        if (config.driver === 'local') {
          return new LocalFileStorageAdapter(config);
        }

        return new SpacesFileStorageAdapter(config);
      },
    },
    {
      provide: FileStorageService,
      useFactory: (repository: FileStorageRepository, adapter: FileStorageAdapter) => {
        const config = getFileStorageRuntimeConfig(process.env);

        return new FileStorageService(repository, adapter, {
          allowedMimeTypes: config.allowedMimeTypes,
          maxBytes: config.maxBytes,
        });
      },
      inject: [FileStorageRepository, FILE_STORAGE_ADAPTER],
    },
  ],
  exports: [FileStorageService],
})
export class FileStorageModule {}
