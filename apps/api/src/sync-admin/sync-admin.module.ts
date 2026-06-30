import { Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { getDatabaseRuntimeConfig, getQueueRuntimeConfig } from '@materiabill/config';
import {
  getDbClient,
  syncFailures,
  type DbClient,
  type MateriabillDatabase,
} from '@materiabill/db';
import { eq, sql } from 'drizzle-orm';

import { InframodernPullSource } from './inframodern-pull-source.js';
import { SyncAdminController } from './sync-admin.controller.js';
import {
  syncAdminRabbitMqConnectionFactory,
  SyncAdminRabbitMqService,
  SYNC_ADMIN_QUEUE_RUNTIME_CONFIG,
  SYNC_ADMIN_RABBITMQ_CONNECTION_FACTORY,
} from './sync-admin-rabbitmq.service.js';
import { SYNC_ADMIN_DB, SyncAdminService, type SyncAdminDatabase } from './sync-admin.service.js';
import { SyncAdminTokenGuard } from './sync-admin-token.guard.js';

export { SYNC_ADMIN_DB } from './sync-admin.service.js';

const SYNC_ADMIN_DB_CLIENT = Symbol('SYNC_ADMIN_DB_CLIENT');

type LazySyncAdminDbClient = {
  getDb(): MateriabillDatabase;
  close(): Promise<void>;
};

@Injectable()
class SyncAdminDbLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(SYNC_ADMIN_DB_CLIENT) private readonly client: LazySyncAdminDbClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}

@Module({
  controllers: [SyncAdminController],
  providers: [
    {
      provide: SYNC_ADMIN_QUEUE_RUNTIME_CONFIG,
      useFactory: () => getQueueRuntimeConfig(process.env),
    },
    {
      provide: SYNC_ADMIN_RABBITMQ_CONNECTION_FACTORY,
      useValue: syncAdminRabbitMqConnectionFactory,
    },
    {
      provide: SYNC_ADMIN_DB_CLIENT,
      useFactory: () => createLazySyncAdminDbClient(),
    },
    {
      provide: SYNC_ADMIN_DB,
      useFactory: (client: LazySyncAdminDbClient) => createLazySyncAdminDatabase(client),
      inject: [SYNC_ADMIN_DB_CLIENT],
    },
    SyncAdminDbLifecycleService,
    SyncAdminTokenGuard,
    SyncAdminRabbitMqService,
    InframodernPullSource,
    SyncAdminService,
  ],
})
export class SyncAdminModule {}

function createLazySyncAdminDbClient(): LazySyncAdminDbClient {
  let client: DbClient | undefined;

  return {
    getDb: () => {
      client ??= getDbClient(getDatabaseRuntimeConfig(process.env));
      return client.db;
    },
    close: async () => {
      await client?.close();
    },
  };
}

function createLazySyncAdminDatabase(client: LazySyncAdminDbClient): SyncAdminDatabase {
  return {
    get query() {
      return client.getDb().query;
    },
    async incrementFailureRetryCount(failureId: string): Promise<void> {
      await client
        .getDb()
        .update(syncFailures)
        .set({ retryCount: sql`${syncFailures.retryCount} + 1` })
        .where(eq(syncFailures.id, failureId));
    },
  };
}
