import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import type { DatabaseRuntimeConfig } from '@materiabill/config';

import * as schema from './schema/index.js';

export type MateriabillDatabase = PostgresJsDatabase<typeof schema>;

export type DbClient = {
  readonly db: MateriabillDatabase;
  close(): Promise<void>;
};

type DbClientOptions = {
  readonly createSql?: (url: string) => Sql;
};

export function getDbClient(
  config: DatabaseRuntimeConfig,
  options: DbClientOptions = {},
): DbClient {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = options.createSql?.(config.databaseUrl) ?? postgres(config.databaseUrl);
  const db = drizzle(sql, { schema, casing: 'snake_case' });

  return {
    db,
    close: () => sql.end(),
  };
}
