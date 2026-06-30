import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { getDatabaseRuntimeConfig, getQueueRuntimeConfig } from '@materiabill/config';
import { getDbClient, type DbClient } from '@materiabill/db';
import * as amqp from 'amqplib';

import {
  INFRAMODERN_SYNC_MESSAGE_PROCESSOR,
  InframodernRabbitMqClientService,
  QUEUE_RUNTIME_CONFIG,
  RABBITMQ_CONNECTION_FACTORY,
} from './rabbitmq-client.service.js';
import { MATERIABILL_DB, ProjectionUpsertService } from './projection-upsert.service.js';
import { SyncMessageProcessorService } from './sync-message-processor.service.js';

const DB_CLIENT = 'DB_CLIENT';

@Injectable()
class InframodernSyncDbLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(DB_CLIENT) private readonly client: DbClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Module({
  providers: [
    {
      provide: QUEUE_RUNTIME_CONFIG,
      useFactory: () => getQueueRuntimeConfig(process.env),
    },
    {
      provide: RABBITMQ_CONNECTION_FACTORY,
      useValue: amqp,
    },
    {
      provide: DB_CLIENT,
      useFactory: () => getDbClient(getDatabaseRuntimeConfig(process.env)),
    },
    {
      provide: MATERIABILL_DB,
      useFactory: (client: DbClient) => client.db,
      inject: [DB_CLIENT],
    },
    ProjectionUpsertService,
    SyncMessageProcessorService,
    {
      provide: INFRAMODERN_SYNC_MESSAGE_PROCESSOR,
      useExisting: SyncMessageProcessorService,
    },
    InframodernSyncDbLifecycleService,
    InframodernRabbitMqClientService,
  ],
  exports: [InframodernRabbitMqClientService],
})
export class InframodernSyncModule {}
