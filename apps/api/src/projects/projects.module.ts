import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { ClientIdentitiesModule } from '../client-identities/client-identities.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsRepository } from './projects.repository.js';
import { ProjectsService } from './projects.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    PermissionsModule,
    SessionModule,
    WorkspaceContextModule,
    ClientIdentitiesModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
