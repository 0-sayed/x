import { getWorkerLoggerOptions, getWorkerRuntimeConfig } from '@materiabill/config';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';

import { waitForShutdownSignal, type ShutdownSignalSource } from '../src/main.js';

describe('worker bootstrap runtime', () => {
  it('uses structured json logger settings for standalone bootstrap', () => {
    const options = getWorkerLoggerOptions(
      getWorkerRuntimeConfig({
        APP_VERSION: '2.0.0',
        NODE_ENV: 'production',
        WORKER_LOG_LEVEL: 'verbose',
      }),
    );

    expect(options.pinoHttp).toMatchObject({
      autoLogging: false,
      base: {
        environment: 'production',
        service: 'materiabill-worker',
        version: '2.0.0',
      },
      level: 'trace',
      messageKey: 'message',
    });
  });

  it('waits for a shutdown signal and unregisters both handlers', async () => {
    const emitter = new EventEmitter();
    const signalSource: ShutdownSignalSource = {
      off: (signal, handler) => {
        emitter.off(signal, handler);
      },
      once: (signal, handler) => {
        emitter.once(signal, handler);
      },
    };
    const waitForSignal = waitForShutdownSignal(signalSource);

    expect(emitter.listenerCount('SIGINT')).toBe(1);
    expect(emitter.listenerCount('SIGTERM')).toBe(1);

    emitter.emit('SIGTERM');

    await expect(waitForSignal).resolves.toBe('SIGTERM');
    expect(emitter.listenerCount('SIGINT')).toBe(0);
    expect(emitter.listenerCount('SIGTERM')).toBe(0);
  });
});
