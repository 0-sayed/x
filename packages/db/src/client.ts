import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import type { DatabaseRuntimeConfig } from '@materiabill/config';

import * as schema from './schema/index.js';

export type MateriabillDatabase = PostgresJsDatabase<typeof schema>;
export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export type DbClient = {
  readonly db: MateriabillDatabase;
  readonly client?: Sql;
  close(): Promise<void>;
};

type DbClientOptions = {
  readonly createSql?: (url: string) => Sql;
};

export function getDbClient(
  config: DatabaseRuntimeConfig,
  options: DbClientOptions = {},
): DbClient {
  const sql = createSqlClient(config.databaseUrl, options);
  const db = drizzle(sql, { schema, casing: 'snake_case' });

  return {
    db,
    client: sql,
    close: () => sql.end(),
  };
}

export function createDatabaseClient(databaseUrl: string | undefined): DbClient {
  const client = createSqlClient(databaseUrl);
  const db = drizzle(client, { schema, casing: 'snake_case' });

  return {
    db,
    client,
    async close(): Promise<void> {
      await client.end();
    },
  };
}

function createSqlClient(databaseUrl: string | undefined, options: DbClientOptions = {}): Sql {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return options.createSql?.(databaseUrl) ?? postgres(databaseUrl, { max: 10 });
}
