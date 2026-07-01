import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
} from '@materiabill/contracts';

import { inframodernUserRefs, workspaceRefs } from './projections.js';

export type NotificationPayload = Record<string, unknown>;

const notificationEventTypeSql = sql`'draw.approved', 'draw.released', 'snag.opened', 'snag.fixed', 'snag.closed', 'variation.submitted', 'variation.approved', 'document.signed', 'invite.accepted', 'invite.declined', 'invite.contractor_nudge'`;
const notificationChannelSql = sql`'in_app', 'email', 'whatsapp'`;
const notificationDeliveryStatusSql = sql`'sent', 'skipped', 'failed', 'placeholder'`;

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 80 }).$type<NotificationEventType>().notNull(),
    channel: varchar('channel', { length: 24 }).$type<NotificationChannel>().notNull(),
    enabled: boolean('enabled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'notification_preferences_event_type_check',
      sql`${table.eventType} in (${notificationEventTypeSql})`,
    ),
    check(
      'notification_preferences_channel_check',
      sql`${table.channel} in (${notificationChannelSql})`,
    ),
    check(
      'notification_preferences_whatsapp_enabled_check',
      sql`not (${table.channel} = 'whatsapp' and ${table.enabled})`,
    ),
    uniqueIndex('notification_preferences_workspace_event_channel_uidx').on(
      table.workspaceId,
      table.eventType,
      table.channel,
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 80 }).$type<NotificationEventType>().notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    payload: jsonb('payload')
      .$type<NotificationPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'notifications_event_type_check',
      sql`${table.eventType} in (${notificationEventTypeSql})`,
    ),
    index('notifications_workspace_recipient_created_at_idx').on(
      table.workspaceId,
      table.recipientUserId,
      table.createdAt,
    ),
    index('notifications_workspace_recipient_read_at_created_at_idx').on(
      table.workspaceId,
      table.recipientUserId,
      table.readAt,
      table.createdAt,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    notificationId: uuid('notification_id').references(() => notifications.id, {
      onDelete: 'set null',
    }),
    recipientUserId: uuid('recipient_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    eventType: varchar('event_type', { length: 80 }).$type<NotificationEventType>().notNull(),
    channel: varchar('channel', { length: 24 }).$type<NotificationChannel>().notNull(),
    status: varchar('status', { length: 24 }).$type<NotificationDeliveryStatus>().notNull(),
    recipientAddress: text('recipient_address'),
    providerMessageId: text('provider_message_id'),
    skippedReason: text('skipped_reason'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'notification_deliveries_event_type_check',
      sql`${table.eventType} in (${notificationEventTypeSql})`,
    ),
    check(
      'notification_deliveries_channel_check',
      sql`${table.channel} in (${notificationChannelSql})`,
    ),
    check(
      'notification_deliveries_status_check',
      sql`${table.status} in (${notificationDeliveryStatusSql})`,
    ),
    index('notification_deliveries_workspace_attempted_at_idx').on(
      table.workspaceId,
      table.attemptedAt,
    ),
    index('notification_deliveries_workspace_notification_attempted_at_idx').on(
      table.workspaceId,
      table.notificationId,
      table.attemptedAt,
    ),
    index('notification_deliveries_workspace_recipient_attempted_at_idx').on(
      table.workspaceId,
      table.recipientUserId,
      table.attemptedAt,
    ),
  ],
);

export type NotificationPreferenceRecord = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferenceRecord = typeof notificationPreferences.$inferInsert;
export type NotificationRecord = typeof notifications.$inferSelect;
export type NewNotificationRecord = typeof notifications.$inferInsert;
export type NotificationDeliveryRecord = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDeliveryRecord = typeof notificationDeliveries.$inferInsert;
