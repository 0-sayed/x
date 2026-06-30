import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';

import { InframodernRabbitMqClientService } from '../../src/inframodern-sync/rabbitmq-client.service.js';

function createMessage(body: string): ConsumeMessage {
  return {
    content: Buffer.from(body, 'utf8'),
  } as ConsumeMessage;
}

function createHarness() {
  const consume = vi.fn();
  const channel = {
    assertExchange: vi.fn(),
    assertQueue: vi.fn(),
    bindQueue: vi.fn(),
    prefetch: vi.fn(),
    consume,
    publish: vi.fn(),
    ack: vi.fn(),
    nack: vi.fn(),
    close: vi.fn(),
  };
  const connection = {
    createChannel: vi.fn(() => Promise.resolve(channel as unknown as Channel)),
    close: vi.fn(),
  } as unknown as ChannelModel;
  const processor = {
    processMessage: vi.fn(),
  };
  const service = new InframodernRabbitMqClientService(
    { rabbitMqUrl: 'amqp://localhost:5672', environmentName: 'testing', appCode: 'materiabill' },
    processor,
    {
      connect: vi.fn(() => Promise.resolve(connection)),
    },
  );

  return { channel, connection, processor, service };
}

async function handleMessage(
  service: InframodernRabbitMqClientService,
  message: ConsumeMessage,
): Promise<void> {
  await (
    service as unknown as {
      handleMessage: (resource: 'users', message: ConsumeMessage) => Promise<void>;
    }
  ).handleMessage('users', message);
}

describe('InframodernRabbitMqClientService', () => {
  it('requires RABBITMQ_URL before starting consumers', async () => {
    const service = new InframodernRabbitMqClientService(
      { rabbitMqUrl: undefined, environmentName: 'testing', appCode: 'materiabill' },
      { processMessage: vi.fn() },
      { connect: vi.fn() },
    );

    await expect(service.startConsumers()).rejects.toThrow('RABBITMQ_URL is required');
  });

  it('declares topology and consumes every required queue', async () => {
    const { channel, service } = createHarness();

    await service.startConsumers();

    expect(channel.prefetch).toHaveBeenCalledWith(10);
    expect(channel.consume).toHaveBeenCalledTimes(4);
  });

  it('acks processed messages and publishes completion when operationId exists', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({
      status: 'processed',
      envelope: {
        correlationId: 'corr-1',
        jobId: 'job-1',
        operationId: 'op-1',
      },
    });

    await service.startConsumers();

    const message = createMessage('{"id":"1"}');

    await handleMessage(service, message);

    expect(processor.processMessage).toHaveBeenCalledWith('users', '{"id":"1"}');
    expect(channel.publish).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks skipped messages without publishing completion', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({ status: 'skipped' });

    await service.startConsumers();

    const message = createMessage('{"id":"2"}');

    await handleMessage(service, message);

    expect(channel.publish).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks skipped messages after publishing completion when the envelope has an operationId', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({
      status: 'skipped',
      envelope: {
        correlationId: 'corr-skipped',
        jobId: 'job-skipped',
        operationId: 'op-skipped',
      },
    });

    await service.startConsumers();

    const message = createMessage('{"id":"skipped"}');

    await handleMessage(service, message);

    expect(channel.publish).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks processed messages without publishing completion when operationId is missing', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({
      status: 'processed',
      envelope: {
        correlationId: 'corr-2',
        jobId: 'job-2',
      },
    });

    await service.startConsumers();

    const message = createMessage('{"id":"3"}');

    await handleMessage(service, message);

    expect(channel.publish).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks failed outcomes without requeueing', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({ status: 'failed' });

    await service.startConsumers();

    const message = createMessage('{"id":"4"}');

    await handleMessage(service, message);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('nacks without requeueing when processing throws', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockRejectedValue(new Error('boom'));

    await service.startConsumers();

    const message = createMessage('{"id":"5"}');

    await handleMessage(service, message);

    expect(channel.publish).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
  });

  it('nacks with requeueing when completion publish throws', async () => {
    const { channel, processor, service } = createHarness();
    processor.processMessage.mockResolvedValue({
      status: 'processed',
      envelope: {
        correlationId: 'corr-3',
        jobId: 'job-3',
        operationId: 'op-3',
      },
    });
    channel.publish.mockImplementation(() => {
      throw new Error('publish failed');
    });

    await service.startConsumers();

    const message = createMessage('{"id":"6"}');

    await handleMessage(service, message);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
