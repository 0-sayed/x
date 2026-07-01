import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { SessionModule } from '../session/session.module.js';
import { SettingsDataModule } from '../settings/settings.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { GraceWindowController } from './grace-window.controller.js';
import { GraceWindowCommitHandlerRegistry } from './grace-window-commit-handlers.js';
import { GraceWindowRepository } from './grace-window.repository.js';
import { GraceWindowService } from './grace-window.service.js';

@Module({
  imports: [AuditModule, SessionModule, WorkspaceContextModule, SettingsDataModule],
  controllers: [GraceWindowController],
  providers: [GraceWindowCommitHandlerRegistry, GraceWindowRepository, GraceWindowService],
  exports: [GraceWindowCommitHandlerRegistry, GraceWindowService],
})
export class GraceWindowModule {}
