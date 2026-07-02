import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { inframodernUserRefs } from './projections.js';

const auditColumns = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const clientIdentities = pgTable(
  'client_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull(),
    email: varchar('email', { length: 320 }),
    phoneE164: varchar('phone_e164', { length: 32 }),
    verifiedEmailAt: timestamp('verified_email_at', { withTimezone: true }),
    verifiedPhoneAt: timestamp('verified_phone_at', { withTimezone: true }),
    inframodernUserId: uuid('inframodern_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    ...auditColumns(),
  },
  (table) => [
    check(
      'client_identities_contact_check',
      sql`${table.email} is not null or ${table.phoneE164} is not null`,
    ),
    check(
      'client_identities_email_verified_check',
      sql`${table.email} is null or ${table.verifiedEmailAt} is not null`,
    ),
    check(
      'client_identities_phone_verified_check',
      sql`${table.phoneE164} is null or ${table.verifiedPhoneAt} is not null`,
    ),
    uniqueIndex('client_identities_email_unique')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} is not null`),
    uniqueIndex('client_identities_phone_e164_unique')
      .on(table.phoneE164)
      .where(sql`${table.phoneE164} is not null`),
    index('client_identities_inframodern_user_idx').on(table.inframodernUserId),
  ],
);

export type ClientIdentityRecord = typeof clientIdentities.$inferSelect;
export type NewClientIdentityRecord = typeof clientIdentities.$inferInsert;
