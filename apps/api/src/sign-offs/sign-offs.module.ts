import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { GraceWindowModule } from '../grace-window/grace-window.module.js';
import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { SignOffsController } from './sign-offs.controller.js';
import { SignOffsRepository } from './sign-offs.repository.js';
import { SignOffsService } from './sign-offs.service.js';

@Module({
  imports: [AuditModule, GraceWindowModule, SessionModule, WorkspaceContextModule],
  controllers: [SignOffsController],
  providers: [SignOffsRepository, SignOffsService],
  exports: [SignOffsService],
})
export class SignOffsModule {}
