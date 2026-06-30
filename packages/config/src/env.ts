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
const booleanStringSchema = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}, z.boolean());

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
  SESSION_SECRET: z.string().trim().min(32).optional(),
  SESSION_ENCRYPTION_KEY: z.string().trim().optional(),
  SESSION_COOKIE_NAME: z.string().trim().min(1).default('materiabill.sid'),
  SESSION_COOKIE_SECURE: booleanStringSchema.default(false),
  OAUTH_STATE_COOKIE_NAME: z.string().trim().min(1).default('materiabill.oauth_state'),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
  OAUTH_STATE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  INFRAMODERN_URL: optionalUrlSchema,
  INFRAMODERN_FRONTEND_URL: optionalUrlSchema,
  ADMIN_URL: optionalUrlSchema,
  INFRAMODERN_OAUTH_MODE: z.enum(['production', 'sandbox']).default('production'),
  INFRAMODERN_OAUTH_CLIENT_ID: z.string().trim().min(1).optional(),
  INFRAMODERN_OAUTH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  INFRAMODERN_OAUTH_CALLBACK_URL: optionalUrlSchema,
  INFRAMODERN_SANDBOX_OAUTH_CLIENT_ID: z.string().trim().min(1).optional(),
  INFRAMODERN_SANDBOX_OAUTH_CLIENT_SECRET: z.string().trim().min(1).optional(),
  INFRAMODERN_SANDBOX_OAUTH_CALLBACK_URL: optionalUrlSchema,
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

export type SessionOAuthMode = 'production' | 'sandbox';

export type SessionOAuthClientConfig = {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly callbackUrl: string;
};

export type SessionRuntimeConfig = {
  readonly sessionSecret: string;
  readonly encryptionKey: string;
  readonly cookieName: string;
  readonly cookieSecure: boolean;
  readonly oauthStateCookieName: string;
  readonly sessionTtlSeconds: number;
  readonly oauthStateTtlSeconds: number;
  readonly inframodernUrl: string;
  readonly inframodernFrontendUrl: string;
  readonly adminUrl: string;
  readonly oauthMode: SessionOAuthMode;
  readonly oauthClient: SessionOAuthClientConfig;
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

function requireConfigValue(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function assertBase64Key(value: string): string {
  const decoded = Buffer.from(value, 'base64');

  if (decoded.length !== 32) {
    throw new Error('SESSION_ENCRYPTION_KEY must decode to 32 bytes');
  }

  return value;
}

function getRequiredSessionOAuthClient(parsed: RuntimeEnv): SessionOAuthClientConfig {
  const isSandbox = parsed.INFRAMODERN_OAUTH_MODE === 'sandbox';
  const clientId = isSandbox
    ? parsed.INFRAMODERN_SANDBOX_OAUTH_CLIENT_ID
    : parsed.INFRAMODERN_OAUTH_CLIENT_ID;
  const clientSecret = isSandbox
    ? parsed.INFRAMODERN_SANDBOX_OAUTH_CLIENT_SECRET
    : parsed.INFRAMODERN_OAUTH_CLIENT_SECRET;
  const callbackUrl = isSandbox
    ? parsed.INFRAMODERN_SANDBOX_OAUTH_CALLBACK_URL
    : parsed.INFRAMODERN_OAUTH_CALLBACK_URL;
  const modeLabel = isSandbox ? 'sandbox' : 'production';

  return {
    clientId: requireConfigValue(clientId, `Missing ${modeLabel} OAuth configuration`),
    clientSecret: requireConfigValue(clientSecret, `Missing ${modeLabel} OAuth configuration`),
    callbackUrl: requireConfigValue(callbackUrl, `Missing ${modeLabel} OAuth configuration`),
  };
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

export function getSessionRuntimeConfig(env: NodeJS.ProcessEnv): SessionRuntimeConfig {
  const parsed = parseRuntimeEnv(env);

  if (!parsed.SESSION_SECRET) {
    throw new Error('Missing session secret');
  }

  if (!parsed.SESSION_ENCRYPTION_KEY) {
    throw new Error('Missing session encryption key');
  }

  if (!parsed.INFRAMODERN_URL) {
    throw new Error('Missing Inframodern URL');
  }

  if (!parsed.INFRAMODERN_FRONTEND_URL) {
    throw new Error('Missing Inframodern frontend URL');
  }

  if (!parsed.ADMIN_URL) {
    throw new Error('Missing admin URL');
  }

  return {
    sessionSecret: parsed.SESSION_SECRET,
    encryptionKey: assertBase64Key(parsed.SESSION_ENCRYPTION_KEY),
    cookieName: parsed.SESSION_COOKIE_NAME,
    cookieSecure: parsed.NODE_ENV === 'production' ? true : parsed.SESSION_COOKIE_SECURE,
    oauthStateCookieName: parsed.OAUTH_STATE_COOKIE_NAME,
    sessionTtlSeconds: parsed.SESSION_TTL_SECONDS,
    oauthStateTtlSeconds: parsed.OAUTH_STATE_TTL_SECONDS,
    inframodernUrl: parsed.INFRAMODERN_URL,
    inframodernFrontendUrl: parsed.INFRAMODERN_FRONTEND_URL,
    adminUrl: parsed.ADMIN_URL,
    oauthMode: parsed.INFRAMODERN_OAUTH_MODE,
    oauthClient: getRequiredSessionOAuthClient(parsed),
  };
}
