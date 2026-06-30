import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { getDatabaseRuntimeConfig } from '@materiabill/config';
import { createDatabaseClient, type DatabaseClient } from '@materiabill/db';

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: (): DatabaseClient =>
        createDatabaseClient(getDatabaseRuntimeConfig(process.env).databaseUrl),
    },
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CLIENT) private readonly databaseClient: DatabaseClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.databaseClient.close();
  }
}
