import { Module } from '@nestjs/common';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { BootstrapInfoController } from './bootstrap-info.controller.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [LoggerModule.forRoot(getApiLoggerOptions(getApiRuntimeConfig(process.env)))],
  controllers: [HealthController, BootstrapInfoController],
})
export class AppModule {}
