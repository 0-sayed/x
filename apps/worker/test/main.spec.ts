import { getWorkerLoggerOptions, getWorkerRuntimeConfig } from '@materiabill/config';
import { EventEmitter } from 'node:events';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Channel, ChannelModel } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';

import { runWorker, waitForShutdownSignal, type ShutdownSignalSource } from '../src/main.js';
import {
  INFRAMODERN_SYNC_MESSAGE_PROCESSOR,
  InframodernRabbitMqClientService,
  QUEUE_RUNTIME_CONFIG,
  RABBITMQ_CONNECTION_FACTORY,
} from '../src/inframodern-sync/rabbitmq-client.service.js';

function createChannel(): Channel {
  return {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    prefetch: vi.fn(),
    consume: vi.fn(),
    publish: vi.fn(),
    waitForConfirms: vi.fn(() => Promise.resolve()),
    close: vi.fn(),
  } as unknown as Channel;
}

@Module({
  providers: [
    {
      provide: QUEUE_RUNTIME_CONFIG,
      useValue: {
        rabbitMqUrl: 'amqp://localhost:5672',
        environmentName: 'testing',
        appCode: 'materiabill',
      },
    },
    {
      provide: INFRAMODERN_SYNC_MESSAGE_PROCESSOR,
      useValue: {
        processMessage: vi.fn(),
      },
    },
    {
      provide: RABBITMQ_CONNECTION_FACTORY,
      useValue: {
        connect: vi.fn(() =>
          Promise.resolve({
            createConfirmChannel: vi.fn(() => Promise.resolve(createChannel())),
            close: vi.fn(),
          } as unknown as ChannelModel),
        ),
      },
    },
    InframodernRabbitMqClientService,
  ],
})
// Nest module classes are declarative metadata carriers.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class RabbitMqClientBootstrapTestModule {}

function createSignalSourceThatEmits(signalToEmit: NodeJS.Signals): ShutdownSignalSource {
  const emitter = new EventEmitter();

  return {
    off: (signal, handler) => {
      emitter.off(signal, handler);
    },
    once: (signal, handler) => {
      emitter.once(signal, handler);

      if (signal === signalToEmit) {
        queueMicrotask(() => {
          emitter.emit(signalToEmit);
        });
      }
    },
  };
}

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

  it('does not close the worker app twice when close fails', async () => {
    const emitter = new EventEmitter();
    const signalSource: ShutdownSignalSource = {
      off: (signal, handler) => {
        emitter.off(signal, handler);
      },
      once: (signal, handler) => {
        emitter.once(signal, handler);
      },
    };
    const closeError = new Error('close failed');
    const app = {
      close: vi.fn().mockRejectedValue(closeError),
      get: vi.fn(() => ({
        log: vi.fn(),
        warn: vi.fn(),
      })),
    };

    const run = runWorker(signalSource, () => Promise.resolve(app));
    const emitWhenReady = setInterval(() => {
      if (emitter.listenerCount('SIGTERM') > 0) {
        clearInterval(emitWhenReady);
        emitter.emit('SIGTERM');
      }
    }, 1);

    await expect(run).rejects.toThrow(closeError);
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it('keeps sync module startup behind explicit RabbitMQ configuration', async () => {
    const app = {
      close: vi.fn(),
      get: vi.fn(() => ({
        log: vi.fn(),
        warn: vi.fn(),
      })),
    };

    const run = runWorker(createSignalSourceThatEmits('SIGTERM'), () => Promise.resolve(app));

    await expect(run).resolves.toBe('SIGTERM');
  });

  it('constructs the RabbitMQ client through Nest DI', async () => {
    const app = await NestFactory.createApplicationContext(RabbitMqClientBootstrapTestModule, {
      logger: false,
    });

    expect(app.get(InframodernRabbitMqClientService)).toBeInstanceOf(
      InframodernRabbitMqClientService,
    );

    await app.close();
  });
});
