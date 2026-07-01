import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

import { notificationDeliveries, notificationPreferences, notifications } from './notifications.js';

describe('notifications schema', () => {
  const notificationsMigrationSql = () => {
    const migration = readdirSync(resolve(process.cwd(), 'drizzle')).find((fileName) =>
      fileName.endsWith('_notifications.sql'),
    );

    if (!migration) {
      throw new Error('Notifications migration not found');
    }

    return readFileSync(resolve(process.cwd(), 'drizzle', migration), 'utf8');
  };

  it('uses workspace-scoped notification preference columns', () => {
    expect(notificationPreferences.id.name).toBe('id');
    expect(notificationPreferences.workspaceId.name).toBe('workspace_id');
    expect(notificationPreferences.eventType.name).toBe('event_type');
    expect(notificationPreferences.channel.name).toBe('channel');
    expect(notificationPreferences.enabled.name).toBe('enabled');
    expect(notificationPreferences.createdAt.name).toBe('created_at');
    expect(notificationPreferences.updatedAt.name).toBe('updated_at');
  });

  it('does not define a default for enabled and rejects whatsapp opt-in at the database level', () => {
    expect(notificationPreferences.enabled.hasDefault).toBe(false);

    const sql = notificationsMigrationSql();
    expect(sql).toContain(
      `CONSTRAINT "notification_preferences_whatsapp_enabled_check" CHECK (not ("notification_preferences"."channel" = 'whatsapp' and "notification_preferences"."enabled"))`,
    );
    expect(sql).not.toContain('"enabled" boolean DEFAULT false NOT NULL');
  });

  it('uses current-user in-app notification columns', () => {
    expect(notifications.id.name).toBe('id');
    expect(notifications.workspaceId.name).toBe('workspace_id');
    expect(notifications.recipientUserId.name).toBe('recipient_user_id');
    expect(notifications.eventType.name).toBe('event_type');
    expect(notifications.title.name).toBe('title');
    expect(notifications.body.name).toBe('body');
    expect(notifications.resourceType.name).toBe('resource_type');
    expect(notifications.resourceId.name).toBe('resource_id');
    expect(notifications.payload.name).toBe('payload');
    expect(notifications.readAt.name).toBe('read_at');
    expect(notifications.createdAt.name).toBe('created_at');
  });

  it('uses append-only delivery attempt columns', () => {
    expect(notificationDeliveries.id.name).toBe('id');
    expect(notificationDeliveries.workspaceId.name).toBe('workspace_id');
    expect(notificationDeliveries.notificationId.name).toBe('notification_id');
    expect(notificationDeliveries.recipientUserId.name).toBe('recipient_user_id');
    expect(notificationDeliveries.channel.name).toBe('channel');
    expect(notificationDeliveries.status.name).toBe('status');
    expect(notificationDeliveries.recipientAddress.name).toBe('recipient_address');
    expect(notificationDeliveries.providerMessageId.name).toBe('provider_message_id');
    expect(notificationDeliveries.skippedReason.name).toBe('skipped_reason');
    expect(notificationDeliveries.errorMessage.name).toBe('error_message');
    expect(notificationDeliveries.attemptedAt.name).toBe('attempted_at');
  });

  it('keeps delivery notification references workspace-scoped', () => {
    const sql = notificationsMigrationSql();

    expect(sql).toContain(
      `CONSTRAINT "notifications_workspace_id_id_unique" UNIQUE("workspace_id","id")`,
    );
    expect(sql).toContain(
      `FOREIGN KEY ("workspace_id","notification_id") REFERENCES "public"."notifications"("workspace_id","id")`,
    );
  });
});
