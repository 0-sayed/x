import { describe, expect, it } from 'vitest';

import {
  getApiRuntimeConfig,
  getDatabaseRuntimeConfig,
  getQueueRuntimeConfig,
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
