import { Module } from '@nestjs/common';

import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextController } from './workspace-context.controller.js';
import { WorkspaceContextGuard } from './workspace-context.guard.js';
import { WorkspaceContextRepository } from './workspace-context.repository.js';
import { WorkspaceContextService } from './workspace-context.service.js';

@Module({
  imports: [SessionModule],
  controllers: [WorkspaceContextController],
  providers: [WorkspaceContextRepository, WorkspaceContextService, WorkspaceContextGuard],
  exports: [WorkspaceContextService, WorkspaceContextGuard],
})
export class WorkspaceContextModule {}
