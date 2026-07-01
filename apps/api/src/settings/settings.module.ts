import { Module } from '@nestjs/common';

import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { SettingsController } from './settings.controller.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

@Module({
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsRepository, SettingsService],
})
export class SettingsDataModule {}

@Module({
  imports: [SettingsDataModule, SessionModule, WorkspaceContextModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
