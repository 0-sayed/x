import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionsModule } from '../permissions/permissions.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { SessionModule } from '../session/session.module.js';
import { SignOffsModule } from '../sign-offs/sign-offs.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { ScheduleController } from './schedule.controller.js';
import { ScheduleRepository } from './schedule.repository.js';
import { ScheduleService } from './schedule.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    RealtimeModule,
    SignOffsModule,
    PermissionsModule,
    SessionModule,
    WorkspaceContextModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleRepository, ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
