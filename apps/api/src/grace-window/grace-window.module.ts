import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { GraceWindowController } from './grace-window.controller.js';
import { GraceWindowRepository } from './grace-window.repository.js';
import { GraceWindowService } from './grace-window.service.js';

@Module({
  imports: [AuditModule, SessionModule, WorkspaceContextModule],
  controllers: [GraceWindowController],
  providers: [GraceWindowRepository, GraceWindowService],
  exports: [GraceWindowService],
})
export class GraceWindowModule {}
