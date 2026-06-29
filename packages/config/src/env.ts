import { z } from 'zod';

const pinoLogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const legacyNestLogLevelSchema = z.enum(['log', 'error', 'warn', 'debug', 'verbose']);
const runtimeLogLevelSchema = z.union([pinoLogLevelSchema, legacyNestLogLevelSchema]);

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: runtimeLogLevelSchema.default('info'),
  API_LOG_LEVEL: runtimeLogLevelSchema.optional(),
  WORKER_LOG_LEVEL: runtimeLogLevelSchema.optional(),
  APP_VERSION: z.string().trim().min(1).default('0.0.0-bootstrap'),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type PinoLogLevel = z.infer<typeof pinoLogLevelSchema>;

export type ApiRuntimeConfig = {
  readonly appName: 'materiabill-api';
  readonly port: number;
  readonly environment: RuntimeEnv['NODE_ENV'];
  readonly logLevel: PinoLogLevel;
  readonly version: string;
};

export type WorkerRuntimeConfig = {
  readonly appName: 'materiabill-worker';
  readonly environment: RuntimeEnv['NODE_ENV'];
  readonly logLevel: PinoLogLevel;
  readonly version: string;
};

function normalizeLogLevel(level: z.infer<typeof runtimeLogLevelSchema>): PinoLogLevel {
  switch (level) {
    case 'log':
      return 'info';
    case 'verbose':
      return 'trace';
    default:
      return level;
  }
}

function selectRuntimeLogLevel(
  parsed: RuntimeEnv,
  scopedLevel: z.infer<typeof runtimeLogLevelSchema> | undefined,
): PinoLogLevel {
  if (scopedLevel) {
    return normalizeLogLevel(scopedLevel);
  }

  if (parsed.LOG_LEVEL !== 'info') {
    return normalizeLogLevel(parsed.LOG_LEVEL);
  }

  return parsed.NODE_ENV === 'test' ? 'silent' : 'info';
}

export function parseRuntimeEnv(env: NodeJS.ProcessEnv): RuntimeEnv {
  return runtimeEnvSchema.parse(env);
}

export function getApiRuntimeConfig(env: NodeJS.ProcessEnv): ApiRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    appName: 'materiabill-api',
    port: parsed.API_PORT,
    environment: parsed.NODE_ENV,
    logLevel: selectRuntimeLogLevel(parsed, parsed.API_LOG_LEVEL),
    version: parsed.APP_VERSION,
  };
}

export function getWorkerRuntimeConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    appName: 'materiabill-worker',
    environment: parsed.NODE_ENV,
    logLevel: selectRuntimeLogLevel(parsed, parsed.WORKER_LOG_LEVEL),
    version: parsed.APP_VERSION,
  };
}
