import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { getWorkerRuntimeConfig } from '@materiabill/config';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module.js';

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

type ShutdownSignalHandler = () => void;

export type ShutdownSignalSource = {
  off(signal: NodeJS.Signals, handler: ShutdownSignalHandler): void;
  once(signal: NodeJS.Signals, handler: ShutdownSignalHandler): void;
};

type WorkerLogger = Pick<Logger, 'log' | 'warn'>;

export type WorkerApp = {
  close(): Promise<void>;
  get(token: typeof Logger): WorkerLogger;
};

export async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.flushLogs();
  return app;
}

export function waitForShutdownSignal(
  signalSource: ShutdownSignalSource = process,
): Promise<NodeJS.Signals> {
  return new Promise((resolve) => {
    const handlers = new Map<NodeJS.Signals, () => void>();
    const keepAliveTimer = setInterval(() => undefined, 60_000);

    const cleanup = () => {
      clearInterval(keepAliveTimer);
      for (const [signal, handler] of handlers) {
        signalSource.off(signal, handler);
      }
    };

    for (const signal of shutdownSignals) {
      const handler = () => {
        cleanup();
        resolve(signal);
      };

      handlers.set(signal, handler);
      signalSource.once(signal, handler);
    }
  });
}

export async function runWorker(
  signalSource: ShutdownSignalSource = process,
  createApp: () => Promise<WorkerApp> = bootstrapWorker,
): Promise<NodeJS.Signals> {
  const config = getWorkerRuntimeConfig(process.env);
  const app = await createApp();
  const logger = app.get(Logger);

  logger.log({ event: 'bootstrap_ready' }, `${config.appName} bootstrap shell ready`);

  const signal = await waitForShutdownSignal(signalSource);

  logger.warn({ event: 'shutdown_requested', signal }, `${config.appName} shutting down`);
  await app.close();

  return signal;
}

const isDirectExecution = import.meta.url === new URL(process.argv[1] ?? '', 'file:').href;

if (isDirectExecution) {
  void runWorker().catch((error: unknown) => {
    process.exitCode = 1;
    console.error(error);
  });
}
