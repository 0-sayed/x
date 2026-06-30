import { describe, expect, it } from 'vitest';

import {
  getApiRuntimeConfig,
  getDatabaseRuntimeConfig,
  getQueueRuntimeConfig,
  getSessionRuntimeConfig,
  getWorkerRuntimeConfig,
  parseRuntimeEnv,
} from './env.js';

describe('runtime environment config', () => {
  it('keeps test logs silent by default', () => {
    expect(getApiRuntimeConfig({ NODE_ENV: 'test' }).logLevel).toBe('silent');
    expect(getWorkerRuntimeConfig({ NODE_ENV: 'test' }).logLevel).toBe('silent');
  });

  it('preserves explicit root log-level overrides in tests', () => {
    expect(getApiRuntimeConfig({ LOG_LEVEL: 'info', NODE_ENV: 'test' }).logLevel).toBe('info');
    expect(getWorkerRuntimeConfig({ LOG_LEVEL: 'warn', NODE_ENV: 'test' }).logLevel).toBe('warn');
  });

  it('allows scoped log-level overrides in tests', () => {
    expect(getApiRuntimeConfig({ API_LOG_LEVEL: 'debug', NODE_ENV: 'test' }).logLevel).toBe(
      'debug',
    );
    expect(getWorkerRuntimeConfig({ NODE_ENV: 'test', WORKER_LOG_LEVEL: 'warn' }).logLevel).toBe(
      'warn',
    );
  });
});

describe('runtime connection config', () => {
  it('normalizes empty database and queue URLs to undefined', () => {
    expect(getDatabaseRuntimeConfig({ DATABASE_URL: '' })).toEqual({
      databaseUrl: undefined,
    });
    expect(getQueueRuntimeConfig({ RABBITMQ_URL: '' })).toEqual({
      rabbitMqUrl: undefined,
    });
  });

  it('preserves valid database and queue URLs', () => {
    expect(
      getDatabaseRuntimeConfig({
        DATABASE_URL: 'postgres://local_user:changeme-local-only@127.0.0.1:55432/materiabill',
      }),
    ).toEqual({
      databaseUrl: 'postgres://local_user:changeme-local-only@127.0.0.1:55432/materiabill',
    });
    expect(
      getQueueRuntimeConfig({
        RABBITMQ_URL: 'amqp://local_user:changeme-local-only@127.0.0.1:55672',
      }),
    ).toEqual({
      rabbitMqUrl: 'amqp://local_user:changeme-local-only@127.0.0.1:55672',
    });
  });

  it('rejects malformed non-empty connection URLs', () => {
    expect(() => parseRuntimeEnv({ DATABASE_URL: 'not a url' })).toThrow();
    expect(() => parseRuntimeEnv({ RABBITMQ_URL: 'not a url' })).toThrow();
  });
});

describe('session runtime config', () => {
  const baseEnv = {
    SESSION_SECRET: '12345678901234567890123456789012',
    SESSION_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    INFRAMODERN_URL: 'http://inframodern.test',
    INFRAMODERN_FRONTEND_URL: 'http://frontend.test',
    ADMIN_URL: 'http://admin.test',
    INFRAMODERN_OAUTH_CLIENT_ID: 'prod-client',
    INFRAMODERN_OAUTH_CLIENT_SECRET: 'prod-secret',
    INFRAMODERN_OAUTH_CALLBACK_URL: 'http://api.test/auth/callback',
  };

  it('selects the production OAuth client by default', () => {
    expect(getSessionRuntimeConfig(baseEnv)).toMatchObject({
      encryptionKey: baseEnv.SESSION_ENCRYPTION_KEY,
      cookieName: 'materiabill.sid',
      oauthStateCookieName: 'materiabill.oauth_state',
      sessionTtlSeconds: 28_800,
      oauthStateTtlSeconds: 600,
      cookieSecure: false,
      oauthMode: 'production',
      inframodernUrl: 'http://inframodern.test',
      inframodernFrontendUrl: 'http://frontend.test',
      adminUrl: 'http://admin.test',
      oauthClient: {
        clientId: 'prod-client',
        clientSecret: 'prod-secret',
        callbackUrl: 'http://api.test/auth/callback',
      },
    });
  });

  it('selects the sandbox OAuth client when sandbox mode is enabled', () => {
    expect(
      getSessionRuntimeConfig({
        ...baseEnv,
        INFRAMODERN_OAUTH_MODE: 'sandbox',
        INFRAMODERN_SANDBOX_OAUTH_CLIENT_ID: 'sandbox-client',
        INFRAMODERN_SANDBOX_OAUTH_CLIENT_SECRET: 'sandbox-secret',
        INFRAMODERN_SANDBOX_OAUTH_CALLBACK_URL: 'http://api.test/auth/sandbox/callback',
      }),
    ).toMatchObject({
      oauthMode: 'sandbox',
      oauthClient: {
        clientId: 'sandbox-client',
        clientSecret: 'sandbox-secret',
        callbackUrl: 'http://api.test/auth/sandbox/callback',
      },
    });
  });

  it('requires production-facing OAuth and admin URLs', () => {
    expect(() =>
      getSessionRuntimeConfig({ ...baseEnv, INFRAMODERN_FRONTEND_URL: undefined }),
    ).toThrow('Missing Inframodern frontend URL');
    expect(() => getSessionRuntimeConfig({ ...baseEnv, ADMIN_URL: undefined })).toThrow(
      'Missing admin URL',
    );
  });

  it('uses an explicit cookie secure flag independent from OAuth mode', () => {
    expect(
      getSessionRuntimeConfig({
        ...baseEnv,
        INFRAMODERN_OAUTH_MODE: 'sandbox',
        INFRAMODERN_SANDBOX_OAUTH_CLIENT_ID: 'sandbox-client',
        INFRAMODERN_SANDBOX_OAUTH_CLIENT_SECRET: 'sandbox-secret',
        INFRAMODERN_SANDBOX_OAUTH_CALLBACK_URL: 'http://api.test/auth/sandbox/callback',
        SESSION_COOKIE_SECURE: 'true',
      }),
    ).toMatchObject({
      cookieSecure: true,
      oauthMode: 'sandbox',
    });
  });

  it('forces secure session cookies in production even when the flag is omitted', () => {
    expect(
      getSessionRuntimeConfig({
        ...baseEnv,
        NODE_ENV: 'production',
      }),
    ).toMatchObject({
      cookieSecure: true,
      oauthMode: 'production',
    });
  });

  it('rejects sandbox mode without sandbox client credentials', () => {
    expect(() =>
      getSessionRuntimeConfig({
        ...baseEnv,
        INFRAMODERN_OAUTH_MODE: 'sandbox',
      }),
    ).toThrow('Missing sandbox OAuth configuration');
  });
});
