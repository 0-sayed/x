import { defineConfig } from 'drizzle-kit';

const localDatabaseUrl = 'postgresql://local_user:changeme-local-only@127.0.0.1:55432/materiabill';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  casing: 'snake_case',
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
