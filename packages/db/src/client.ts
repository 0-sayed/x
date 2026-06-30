import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export function createDatabaseClient(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = postgres(databaseUrl, { max: 10 });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  return {
    db,
    client,
    async close(): Promise<void> {
      await client.end();
    },
  };
}
