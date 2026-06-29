import { Module } from '@nestjs/common';
import { getWorkerLoggerOptions, getWorkerRuntimeConfig } from '@materiabill/config';
import { LoggerModule } from 'nestjs-pino';

import { WorkerHealthService } from './worker-health.service.js';

@Module({
  imports: [LoggerModule.forRoot(getWorkerLoggerOptions(getWorkerRuntimeConfig(process.env)))],
  providers: [WorkerHealthService],
  exports: [WorkerHealthService],
})
export class WorkerModule {}
