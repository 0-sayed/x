import { z } from 'zod';

const pinoLogLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const legacyNestLogLevelSchema = z.enum(['log', 'error', 'warn', 'debug', 'verbose']);
const runtimeLogLevelSchema = z.union([pinoLogLevelSchema, legacyNestLogLevelSchema]);
const optionalUrlSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.url().optional(),
);
const namespaceTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/)
  .default('testing');
const optionalSecretSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: runtimeLogLevelSchema.default('info'),
  API_LOG_LEVEL: runtimeLogLevelSchema.optional(),
  WORKER_LOG_LEVEL: runtimeLogLevelSchema.optional(),
  APP_VERSION: z.string().trim().min(1).default('0.0.0-bootstrap'),
  DATABASE_URL: optionalUrlSchema,
  RABBITMQ_URL: optionalUrlSchema,
  RABBITMQ_ENVIRONMENT: namespaceTokenSchema,
  RABBITMQ_APP_CODE: namespaceTokenSchema.default('materiabill'),
  SYNC_ADMIN_TOKEN: optionalSecretSchema,
  INFRAMODERN_DB_URL: optionalUrlSchema,
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

export type DatabaseRuntimeConfig = {
  readonly databaseUrl: string | undefined;
};

export type QueueRuntimeConfig = {
  readonly rabbitMqUrl: string | undefined;
  readonly environmentName: string;
  readonly appCode: string;
};

export type SyncAdminRuntimeConfig = {
  readonly syncAdminToken: string | undefined;
  readonly inframodernDbUrl: string | undefined;
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

function hasDefinedEnvValue(env: NodeJS.ProcessEnv, name: keyof RuntimeEnv): boolean {
  return Object.prototype.hasOwnProperty.call(env, name) && env[name] !== undefined;
}

function selectRuntimeLogLevel(
  parsed: RuntimeEnv,
  scopedLevel: z.infer<typeof runtimeLogLevelSchema> | undefined,
  rootLogLevelWasSet: boolean,
): PinoLogLevel {
  if (scopedLevel) {
    return normalizeLogLevel(scopedLevel);
  }

  if (rootLogLevelWasSet) {
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
    logLevel: selectRuntimeLogLevel(
      parsed,
      parsed.API_LOG_LEVEL,
      hasDefinedEnvValue(env, 'LOG_LEVEL'),
    ),
    version: parsed.APP_VERSION,
  };
}

export function getWorkerRuntimeConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    appName: 'materiabill-worker',
    environment: parsed.NODE_ENV,
    logLevel: selectRuntimeLogLevel(
      parsed,
      parsed.WORKER_LOG_LEVEL,
      hasDefinedEnvValue(env, 'LOG_LEVEL'),
    ),
    version: parsed.APP_VERSION,
  };
}

export function getDatabaseRuntimeConfig(env: NodeJS.ProcessEnv): DatabaseRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    databaseUrl: parsed.DATABASE_URL,
  };
}

export function getQueueRuntimeConfig(env: NodeJS.ProcessEnv): QueueRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    rabbitMqUrl: parsed.RABBITMQ_URL,
    environmentName: parsed.RABBITMQ_ENVIRONMENT,
    appCode: parsed.RABBITMQ_APP_CODE,
  };
}

export function getSyncAdminRuntimeConfig(env: NodeJS.ProcessEnv): SyncAdminRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  return {
    syncAdminToken: parsed.SYNC_ADMIN_TOKEN,
    inframodernDbUrl: parsed.INFRAMODERN_DB_URL,
  };
}
