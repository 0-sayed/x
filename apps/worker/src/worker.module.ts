import { Module } from '@nestjs/common';
import { getWorkerLoggerOptions, getWorkerRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { InframodernSyncModule } from './inframodern-sync/inframodern-sync.module.js';
import { WorkerHealthService } from './worker-health.service.js';

@Module({
  imports: [
    LoggerModule.forRoot(getWorkerLoggerOptions(getWorkerRuntimeConfig(process.env))),
    InframodernSyncModule,
  ],
  providers: [WorkerHealthService],
  exports: [WorkerHealthService],
})
export class WorkerModule {}
