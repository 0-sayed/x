import { describe, expect, it } from 'vitest';

import { getApiRuntimeConfig, getWorkerRuntimeConfig } from './env.js';

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
