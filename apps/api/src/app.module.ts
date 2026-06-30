import { Module } from '@nestjs/common';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { BootstrapInfoController } from './bootstrap-info.controller.js';
import { HealthController } from './health.controller.js';
import { SyncAdminModule } from './sync-admin/sync-admin.module.js';

@Module({
  imports: [
    LoggerModule.forRoot(getApiLoggerOptions(getApiRuntimeConfig(process.env))),
    SyncAdminModule,
  ],
  controllers: [HealthController, BootstrapInfoController],
})
export class AppModule {}
