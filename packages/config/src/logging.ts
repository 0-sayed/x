import type { Params } from 'nestjs-pino';

import type { ApiRuntimeConfig, WorkerRuntimeConfig } from './env.js';

function createStructuredLoggerOptions(
  config: ApiRuntimeConfig | WorkerRuntimeConfig,
  autoLogging: boolean,
): Params {
  return {
    pinoHttp: {
      autoLogging,
      base: {
        service: config.appName,
        environment: config.environment,
        version: config.version,
      },
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      level: config.logLevel,
      messageKey: 'message',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        remove: true,
      },
    },
  };
}

export function getApiLoggerOptions(config: ApiRuntimeConfig): Params {
  return createStructuredLoggerOptions(config, true);
}

export function getWorkerLoggerOptions(config: WorkerRuntimeConfig): Params {
  return createStructuredLoggerOptions(config, false);
}
