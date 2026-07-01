import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

type RawProjectionPayload = Record<string, unknown>;
type PermissionKeysPayload = readonly string[];

const projectionColumns = () => ({
  rawPayload: jsonb('raw_payload').$type<RawProjectionPayload>().notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const inframodernUserRefs = pgTable(
  'inframodern_user_refs',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    locale: varchar('locale', { length: 16 }),
    ...projectionColumns(),
  },
  (table) => [index('inframodern_user_refs_email_idx').on(table.email)],
);

export const workspaceRefs = pgTable(
  'workspace_refs',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug'),
    paymentCurrency: varchar('payment_currency', { length: 3 }),
    ...projectionColumns(),
  },
  (table) => [index('workspace_refs_slug_idx').on(table.slug)],
);

export const workspaceMembershipRefs = pgTable(
  'workspace_membership_refs',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'cascade' }),
    roleKey: text('role_key'),
    permissions: jsonb('permissions')
      .$type<PermissionKeysPayload>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isAdmin: boolean('is_admin').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...projectionColumns(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId],
      name: 'workspace_membership_refs_workspace_id_user_id_pk',
    }),
    index('workspace_membership_refs_user_id_idx').on(table.userId),
  ],
);

export const brandRefs = pgTable(
  'brand_refs',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaceRefs.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    accentColor: varchar('accent_color', { length: 32 }),
    logoUrl: text('logo_url'),
    customDomain: text('custom_domain'),
    ...projectionColumns(),
  },
  (table) => [index('brand_refs_workspace_id_idx').on(table.workspaceId)],
);

export const locationRefs = pgTable(
  'location_refs',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id').references(() => workspaceRefs.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    addressLine1: text('address_line_1'),
    addressLine2: text('address_line_2'),
    city: text('city'),
    region: text('region'),
    countryCode: varchar('country_code', { length: 2 }),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    ...projectionColumns(),
  },
  (table) => [
    unique('location_refs_workspace_id_id_unique').on(table.workspaceId, table.id),
    index('location_refs_workspace_id_idx').on(table.workspaceId),
  ],
);

export const exchangeRateRefs = pgTable(
  'exchange_rate_refs',
  {
    id: uuid('id').primaryKey(),
    baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 3 }).notNull(),
    rate: numeric('rate', { precision: 24, scale: 12 }).notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    source: text('source'),
    ...projectionColumns(),
  },
  (table) => [
    index('exchange_rate_refs_base_quote_effective_at_idx').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveAt,
    ),
  ],
);

export const measurementUnitRefs = pgTable(
  'measurement_unit_refs',
  {
    id: uuid('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    symbol: text('symbol'),
    category: text('category'),
    ...projectionColumns(),
  },
  (table) => [index('measurement_unit_refs_code_idx').on(table.code)],
);

export const taxRefs = pgTable(
  'tax_refs',
  {
    id: uuid('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    rate: numeric('rate', { precision: 8, scale: 5 }).notNull(),
    countryCode: varchar('country_code', { length: 2 }),
    ...projectionColumns(),
  },
  (table) => [index('tax_refs_code_idx').on(table.code)],
);

export type InframodernUserRef = typeof inframodernUserRefs.$inferSelect;
export type NewInframodernUserRef = typeof inframodernUserRefs.$inferInsert;
export type WorkspaceRef = typeof workspaceRefs.$inferSelect;
export type NewWorkspaceRef = typeof workspaceRefs.$inferInsert;
export type WorkspaceMembershipRef = typeof workspaceMembershipRefs.$inferSelect;
export type NewWorkspaceMembershipRef = typeof workspaceMembershipRefs.$inferInsert;
export type BrandRef = typeof brandRefs.$inferSelect;
export type NewBrandRef = typeof brandRefs.$inferInsert;
export type LocationRef = typeof locationRefs.$inferSelect;
export type NewLocationRef = typeof locationRefs.$inferInsert;
export type ExchangeRateRef = typeof exchangeRateRefs.$inferSelect;
export type NewExchangeRateRef = typeof exchangeRateRefs.$inferInsert;
export type MeasurementUnitRef = typeof measurementUnitRefs.$inferSelect;
export type NewMeasurementUnitRef = typeof measurementUnitRefs.$inferInsert;
export type TaxRef = typeof taxRefs.$inferSelect;
export type NewTaxRef = typeof taxRefs.$inferInsert;
