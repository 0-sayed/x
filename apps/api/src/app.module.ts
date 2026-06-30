import { Module } from '@nestjs/common';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { BootstrapInfoController } from './bootstrap-info.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { SessionModule } from './session/session.module.js';

@Module({
  imports: [
    LoggerModule.forRoot(getApiLoggerOptions(getApiRuntimeConfig(process.env))),
    DatabaseModule,
    SessionModule,
  ],
  controllers: [HealthController, BootstrapInfoController],
})
export class AppModule {}
