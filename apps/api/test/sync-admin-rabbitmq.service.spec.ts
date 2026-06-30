import type { Channel, ChannelModel } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';

import { SyncAdminRabbitMqService } from '../src/sync-admin/sync-admin-rabbitmq.service.js';

function createHarness() {
  const channel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    publish: vi.fn(),
    close: vi.fn(),
  };
  const connection = {
    createChannel: vi.fn(() => Promise.resolve(channel as unknown as Channel)),
    close: vi.fn(),
  } as unknown as ChannelModel;
  const service = new SyncAdminRabbitMqService(
    {
      rabbitMqUrl: 'amqp://localhost:5672',
      environmentName: 'testing',
      appCode: 'materiabill',
    },
    {
      connect: vi.fn(() => Promise.resolve(connection)),
    },
  );

  return { channel, connection, service };
}

describe('SyncAdminRabbitMqService', () => {
  it('declares and binds sync queues before publishing admin messages', async () => {
    const { channel, service } = createHarness();

    await service.publishEnvelope('users', {
      items: [{ id: 'user-1' }],
      correlationId: 'corr-1',
      operationId: 'op-1',
      targetApp: 'materiabill',
    });

    expect(channel.assertExchange).toHaveBeenCalledWith('x.inframodern-testing', 'topic', {
      durable: true,
    });
    expect(channel.assertExchange).toHaveBeenCalledWith('dlx.inframodern-testing', 'topic', {
      durable: true,
    });
    expect(channel.assertQueue).toHaveBeenCalledTimes(4);
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'q.inframodern-testing.materiabill-testing.users',
      'x.inframodern-testing',
      'inframodern-testing.users',
    );
    expect(channel.publish).toHaveBeenCalledWith(
      'x.inframodern-testing',
      'inframodern-testing.users',
      expect.any(Buffer),
      { contentType: 'application/json', persistent: true },
    );
  });
});
