import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

export const fileAssets = pgTable(
  'file_assets',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'restrict' }),
    purpose: varchar('purpose', { length: 32 }).notNull(),
    storageProvider: varchar('storage_provider', { length: 16 }).notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 16 }).notNull().default('uploaded'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('file_assets_workspace_id_idx').on(table.workspaceId),
    index('file_assets_uploaded_by_user_id_idx').on(table.uploadedByUserId),
    index('file_assets_workspace_purpose_created_at_idx').on(
      table.workspaceId,
      table.purpose,
      table.createdAt,
    ),
    index('file_assets_checksum_sha256_idx').on(table.checksumSha256),
    unique('file_assets_storage_key_uidx').on(table.storageKey),
  ],
);

export type FileAsset = typeof fileAssets.$inferSelect;
export type NewFileAsset = typeof fileAssets.$inferInsert;
