import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

export const sessionRecords = pgTable(
  'session_records',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'cascade' }),
    activeWorkspaceId: uuid('active_workspace_id').references(() => workspaceRefs.id, {
      onDelete: 'set null',
    }),
    encryptedTokens: text('encrypted_tokens').notNull(),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('session_records_user_id_idx').on(table.userId),
    index('session_records_expires_at_idx').on(table.expiresAt),
    index('session_records_revoked_at_idx').on(table.revokedAt),
  ],
);

export type SessionRecord = typeof sessionRecords.$inferSelect;
export type NewSessionRecord = typeof sessionRecords.$inferInsert;
