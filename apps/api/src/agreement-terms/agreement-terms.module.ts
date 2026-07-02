import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { AgreementTermsController } from './agreement-terms.controller.js';
import { AgreementTermsRepository } from './agreement-terms.repository.js';
import { AgreementTermsService } from './agreement-terms.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, PermissionsModule, SessionModule, WorkspaceContextModule],
  controllers: [AgreementTermsController],
  providers: [AgreementTermsRepository, AgreementTermsService],
  exports: [AgreementTermsService],
})
export class AgreementTermsModule {}
