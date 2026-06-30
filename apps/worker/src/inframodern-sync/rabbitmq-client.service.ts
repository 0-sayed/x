import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { QueueRuntimeConfig } from '@materiabill/config';
import {
  getInframodernTopology,
  type SyncEnvelope,
  type SyncResource,
} from '@materiabill/contracts';
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';

import { requiredSyncResources } from './sync-resources.js';

export const QUEUE_RUNTIME_CONFIG = Symbol('QUEUE_RUNTIME_CONFIG');
export const INFRAMODERN_SYNC_MESSAGE_PROCESSOR = Symbol('INFRAMODERN_SYNC_MESSAGE_PROCESSOR');
export const RABBITMQ_CONNECTION_FACTORY = Symbol('RABBITMQ_CONNECTION_FACTORY');

export type RabbitMqConnectionFactory = {
  connect(url: string): Promise<ChannelModel>;
};

type MessageProcessingOutcome =
  | { readonly status: 'processed'; readonly envelope: SyncEnvelope }
  | { readonly status: 'skipped'; readonly envelope?: SyncEnvelope }
  | { readonly status: 'failed' };

export type InframodernSyncMessageProcessor = {
  processMessage(resource: SyncResource, content: string): Promise<MessageProcessingOutcome>;
};

@Injectable()
export class InframodernRabbitMqClientService implements OnModuleInit, OnApplicationShutdown {
  private connection: ChannelModel | undefined;
  private channel: ConfirmChannel | undefined;

  constructor(
    @Inject(QUEUE_RUNTIME_CONFIG) private readonly config: QueueRuntimeConfig,
    @Inject(INFRAMODERN_SYNC_MESSAGE_PROCESSOR)
    private readonly processor: InframodernSyncMessageProcessor,
    @Inject(RABBITMQ_CONNECTION_FACTORY)
    private readonly connectionFactory: RabbitMqConnectionFactory,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.startConsumers();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async startConsumers(): Promise<void> {
    if (!this.config.rabbitMqUrl) {
      throw new Error('RABBITMQ_URL is required');
    }

    this.connection = await this.connectionFactory.connect(this.config.rabbitMqUrl);
    const channel = await this.connection.createConfirmChannel();
    this.channel = channel;

    const topology = getInframodernTopology(this.config, requiredSyncResources);

    await channel.assertExchange(topology.exchange, 'topic', { durable: true });
    await channel.assertExchange(topology.deadLetterExchange, 'topic', { durable: true });
    await channel.prefetch(10);

    for (const resource of requiredSyncResources) {
      const queue = topology.queues[resource];
      await channel.assertQueue(queue.queue, topology.queueOptions(resource));
      await channel.bindQueue(queue.queue, topology.exchange, queue.routingKey);
      await channel.assertQueue(queue.deadLetterQueue, { durable: true });
      await channel.bindQueue(
        queue.deadLetterQueue,
        topology.deadLetterExchange,
        queue.deadLetterRoutingKey,
      );
      await channel.consume(queue.queue, (message) => void this.handleMessage(resource, message));
    }
  }

  async publishEnvelope(resource: SyncResource, envelope: SyncEnvelope): Promise<void> {
    const channel = await this.getPublishChannel();
    const topology = getInframodernTopology(this.config, requiredSyncResources);

    channel.publish(
      topology.exchange,
      topology.queues[resource].routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { contentType: 'application/json', persistent: true },
    );
    await channel.waitForConfirms();
  }

  async publishCompletion(envelope: SyncEnvelope): Promise<void> {
    if (!envelope.operationId) {
      return;
    }

    const channel = await this.getPublishChannel();
    const topology = getInframodernTopology(this.config, requiredSyncResources);

    channel.publish(
      topology.exchange,
      topology.completionRoutingKey,
      Buffer.from(
        JSON.stringify({
          correlationId: envelope.correlationId,
          jobId: envelope.jobId,
          operationId: envelope.operationId,
          status: 'processed',
        }),
      ),
      { contentType: 'application/json', persistent: true },
    );
    await channel.waitForConfirms();
  }

  private async handleMessage(
    resource: SyncResource,
    message: ConsumeMessage | null,
  ): Promise<void> {
    const channel = this.channel;

    if (!message || !channel) {
      return;
    }

    let outcome: MessageProcessingOutcome;

    try {
      outcome = await this.processor.processMessage(resource, message.content.toString('utf8'));
    } catch {
      channel.nack(message, false, false);
      return;
    }

    if (outcome.status === 'failed') {
      channel.nack(message, false, false);
      return;
    }

    try {
      if (outcome.envelope) {
        await this.publishCompletion(outcome.envelope);
      }

      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
    }
  }

  private async getPublishChannel(): Promise<ConfirmChannel> {
    if (!this.channel) {
      await this.startConsumers();
    }

    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    return this.channel;
  }
}
