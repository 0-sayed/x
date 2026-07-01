import { Module } from '@nestjs/common';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { AuditModule } from './audit/audit.module.js';
import { AudienceModule } from './audience/audience.module.js';
import { BootstrapInfoController } from './bootstrap-info.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { GraceWindowModule } from './grace-window/grace-window.module.js';
import { FileStorageModule } from './file-storage/file-storage.module.js';
import { HealthController } from './health.controller.js';
import { PermissionsController } from './permissions/permissions.controller.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { SyncAdminModule } from './sync-admin/sync-admin.module.js';
import { SessionModule } from './session/session.module.js';
import { WorkspaceContextModule } from './workspace-context/workspace-context.module.js';

@Module({
  imports: [
    LoggerModule.forRoot(getApiLoggerOptions(getApiRuntimeConfig(process.env))),
    DatabaseModule,
    SyncAdminModule,
    SessionModule,
    WorkspaceContextModule,
    RealtimeModule,
    AuditModule,
    AudienceModule,
    GraceWindowModule,
    FileStorageModule,
    PermissionsModule,
    SettingsModule,
  ],
  controllers: [HealthController, BootstrapInfoController, PermissionsController],
})
export class AppModule {}
