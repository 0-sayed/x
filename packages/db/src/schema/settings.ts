import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  DefaultDisclosureDepth,
  DefaultLanguage,
  WorkspaceNotificationPreferences,
} from '@materiabill/contracts';

import { workspaceRefs } from './projections.js';

const notificationPreferencesDefaultSql = sql.raw(
  `'{"default":{"inApp":true,"email":true,"whatsapp":false},"contractorInviteAutoNudge":{"inApp":true,"email":true,"whatsapp":false}}'::jsonb`,
);

export const workspaceSettings = pgTable(
  'workspace_settings',
  {
    workspaceId: uuid('workspace_id')
      .primaryKey()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    currency: varchar('currency', { length: 3 }).notNull().default('SAR'),
    timezone: text('timezone').notNull().default('Asia/Riyadh'),
    defaultLanguage: varchar('default_language', { length: 8 })
      .$type<DefaultLanguage>()
      .notNull()
      .default('en'),
    defaultRetentionPercentage: integer('default_retention_percentage').notNull().default(5),
    graceWindowMinutes: integer('grace_window_minutes').notNull().default(10),
    defaultDisclosureDepth: varchar('default_disclosure_depth', { length: 16 })
      .$type<DefaultDisclosureDepth>()
      .notNull()
      .default('none'),
    suggestionThrottlePerMaterial: integer('suggestion_throttle_per_material')
      .notNull()
      .default(5),
    inviteAutoNudgeHours: integer('invite_auto_nudge_hours').notNull().default(48),
    notificationPreferences: jsonb('notification_preferences')
      .$type<WorkspaceNotificationPreferences>()
      .notNull()
      .default(notificationPreferencesDefaultSql),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('workspace_settings_currency_check', sql`${table.currency} IN ('SAR', 'EGP')`),
    check(
      'workspace_settings_default_language_check',
      sql`${table.defaultLanguage} IN ('en', 'ar')`,
    ),
    check(
      'workspace_settings_default_retention_percentage_check',
      sql`${table.defaultRetentionPercentage} >= 0 AND ${table.defaultRetentionPercentage} <= 100`,
    ),
    check(
      'workspace_settings_grace_window_minutes_check',
      sql`${table.graceWindowMinutes} >= 1 AND ${table.graceWindowMinutes} <= 1440`,
    ),
    check(
      'workspace_settings_default_disclosure_depth_check',
      sql`${table.defaultDisclosureDepth} IN ('none', 'category', 'line')`,
    ),
    check(
      'workspace_settings_suggestion_throttle_per_material_check',
      sql`${table.suggestionThrottlePerMaterial} >= 0 AND ${table.suggestionThrottlePerMaterial} <= 100`,
    ),
    check(
      'workspace_settings_invite_auto_nudge_hours_check',
      sql`${table.inviteAutoNudgeHours} >= 1 AND ${table.inviteAutoNudgeHours} <= 720`,
    ),
  ],
);

export type WorkspaceSettingsRecord = typeof workspaceSettings.$inferSelect;
export type NewWorkspaceSettingsRecord = typeof workspaceSettings.$inferInsert;
