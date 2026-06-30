import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { QueueRuntimeConfig } from '@materiabill/config';
import {
  getInframodernTopology,
  type SyncEnvelope,
  type SyncResource,
} from '@materiabill/contracts';
import * as amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

export const SYNC_ADMIN_QUEUE_RUNTIME_CONFIG = Symbol('SYNC_ADMIN_QUEUE_RUNTIME_CONFIG');
export const SYNC_ADMIN_RABBITMQ_CONNECTION_FACTORY = Symbol(
  'SYNC_ADMIN_RABBITMQ_CONNECTION_FACTORY',
);

export type SyncAdminRabbitMqConnectionFactory = {
  connect(url: string): Promise<ChannelModel>;
};

const syncResources = [
  'users',
  'brands',
  'locations',
  'exchange-rates',
] as const satisfies readonly SyncResource[];

@Injectable()
export class SyncAdminRabbitMqService implements OnApplicationShutdown {
  private connection: ChannelModel | undefined;
  private channel: ConfirmChannel | undefined;

  constructor(
    @Inject(SYNC_ADMIN_QUEUE_RUNTIME_CONFIG) private readonly config: QueueRuntimeConfig,
    @Inject(SYNC_ADMIN_RABBITMQ_CONNECTION_FACTORY)
    private readonly connectionFactory: SyncAdminRabbitMqConnectionFactory,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async publishEnvelope(resource: SyncResource, envelope: SyncEnvelope): Promise<void> {
    if (!this.config.rabbitMqUrl) {
      throw new Error('RABBITMQ_URL is required');
    }

    const channel = await this.getPublishChannel();
    const topology = getInframodernTopology(this.config, syncResources);

    channel.publish(
      topology.exchange,
      topology.queues[resource].routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { contentType: 'application/json', persistent: true },
    );
    await channel.waitForConfirms();
  }

  private async getPublishChannel(): Promise<ConfirmChannel> {
    if (this.channel) {
      return this.channel;
    }

    if (!this.config.rabbitMqUrl) {
      throw new Error('RABBITMQ_URL is required');
    }

    this.connection = await this.connectionFactory.connect(this.config.rabbitMqUrl);
    this.channel = await this.connection.createConfirmChannel();

    const topology = getInframodernTopology(this.config, syncResources);
    await this.channel.assertExchange(topology.exchange, 'topic', { durable: true });
    await this.channel.assertExchange(topology.deadLetterExchange, 'topic', { durable: true });

    for (const resource of syncResources) {
      const queue = topology.queues[resource];
      await this.channel.assertQueue(queue.queue, topology.queueOptions(resource));
      await this.channel.bindQueue(queue.queue, topology.exchange, queue.routingKey);
      await this.channel.assertQueue(queue.deadLetterQueue, { durable: true });
      await this.channel.bindQueue(
        queue.deadLetterQueue,
        topology.deadLetterExchange,
        queue.deadLetterRoutingKey,
      );
    }

    return this.channel;
  }
}

export const syncAdminRabbitMqConnectionFactory: SyncAdminRabbitMqConnectionFactory = amqp;
