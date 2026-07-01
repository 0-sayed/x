import type { NotificationChannel, NotificationEventType } from '@materiabill/contracts';
import {
  notificationDeliveries,
  notificationPreferences,
  notifications,
  workspaceMembershipRefs,
  type DatabaseClient,
  type NotificationDeliveryRecord,
  type NotificationPreferenceRecord,
  type NotificationRecord,
} from '@materiabill/db';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  CountUnreadNotificationsInput,
  CreateNotificationRoutesInput,
  CreateNotificationRoutesResult,
  CreateNotificationDeliveryRecordInput,
  CreateNotificationRecordInput,
  ListNotificationsInput,
  MarkAllNotificationsReadInput,
  MarkNotificationReadInput,
  ReplaceNotificationPreferencesInput,
} from './notifications.types.js';

type Db = DatabaseClient['db'];
type PreferenceDb = Pick<Db, 'insert' | 'select'>;
type RouteWriteDb = Pick<Db, 'insert'>;

export const notificationEventTypes: readonly NotificationEventType[] = [
  'draw.approved',
  'draw.released',
  'snag.opened',
  'snag.fixed',
  'snag.closed',
  'variation.submitted',
  'variation.approved',
  'document.signed',
  'invite.accepted',
  'invite.declined',
  'invite.contractor_nudge',
];

export const notificationChannels: readonly NotificationChannel[] = ['in_app', 'email', 'whatsapp'];

@Injectable()
export class NotificationsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async ensureDefaultPreferences(workspaceId: string): Promise<NotificationPreferenceRecord[]> {
    return this.#ensureDefaultPreferences(workspaceId, this.#db);
  }

  async #ensureDefaultPreferences(
    workspaceId: string,
    db: PreferenceDb,
  ): Promise<NotificationPreferenceRecord[]> {
    const values = notificationEventTypes.flatMap((eventType) =>
      notificationChannels.map((channel) => ({
        workspaceId,
        eventType,
        channel,
        enabled: channel !== 'whatsapp',
      })),
    );

    return db
      .insert(notificationPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: [
          notificationPreferences.workspaceId,
          notificationPreferences.eventType,
          notificationPreferences.channel,
        ],
        set: {
          workspaceId: sql`excluded.workspace_id`,
        },
      })
      .returning();
  }

  async replacePreferences(
    input: ReplaceNotificationPreferencesInput,
  ): Promise<NotificationPreferenceRecord[]> {
    return this.#db.transaction(async (tx) => {
      await this.#ensureDefaultPreferences(input.workspaceId, tx);

      if (input.preferences.length > 0) {
        await tx
          .insert(notificationPreferences)
          .values(
            input.preferences.map((preference) => ({
              workspaceId: input.workspaceId,
              eventType: preference.eventType,
              channel: preference.channel,
              enabled: preference.enabled,
            })),
          )
          .onConflictDoUpdate({
            target: [
              notificationPreferences.workspaceId,
              notificationPreferences.eventType,
              notificationPreferences.channel,
            ],
            set: {
              enabled: sql.raw('excluded.enabled'),
              updatedAt: new Date(),
            },
          })
          .returning();
      }

      return this.#listPreferences(input.workspaceId, tx);
    });
  }

  async listPreferences(workspaceId: string): Promise<NotificationPreferenceRecord[]> {
    const existing = await this.#listPreferences(workspaceId, this.#db);
    const expectedCount = notificationEventTypes.length * notificationChannels.length;
    if (existing.length === expectedCount) {
      return existing;
    }

    await this.#ensureDefaultPreferences(workspaceId, this.#db);

    return this.#listPreferences(workspaceId, this.#db);
  }

  async #listPreferences(
    workspaceId: string,
    db: PreferenceDb,
  ): Promise<NotificationPreferenceRecord[]> {
    return db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.workspaceId, workspaceId));
  }

  async findMissingActiveRecipientIds(
    workspaceId: string,
    recipientUserIds: readonly string[],
  ): Promise<string[]> {
    const uniqueRecipientUserIds = [...new Set(recipientUserIds)];

    if (uniqueRecipientUserIds.length === 0) {
      return [];
    }

    const rows = await this.#db
      .select({ userId: workspaceMembershipRefs.userId })
      .from(workspaceMembershipRefs)
      .where(
        and(
          eq(workspaceMembershipRefs.workspaceId, workspaceId),
          inArray(workspaceMembershipRefs.userId, uniqueRecipientUserIds),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
        ),
      );
    const activeUserIds = new Set(rows.map((row) => row.userId));

    return uniqueRecipientUserIds.filter((recipientUserId) => !activeUserIds.has(recipientUserId));
  }

  async createNotification(input: CreateNotificationRecordInput): Promise<NotificationRecord> {
    const rows = await this.#db.insert(notifications).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert notification');
    }

    return row;
  }

  async createNotificationRoutes(
    input: CreateNotificationRoutesInput,
  ): Promise<CreateNotificationRoutesResult> {
    return this.#db.transaction(async (tx) => this.#createNotificationRoutes(input, tx));
  }

  async #createNotificationRoutes(
    input: CreateNotificationRoutesInput,
    db: RouteWriteDb,
  ): Promise<CreateNotificationRoutesResult> {
    const notificationRoutes: CreateNotificationRoutesResult['notificationRoutes'][number][] = [];
    const deliveryInputs: CreateNotificationDeliveryRecordInput[] = [...input.deliveries];

    for (const route of input.notifications) {
      const notification = await insertNotification(db, route.notification);
      const deliveryInput: CreateNotificationDeliveryRecordInput = {
        ...route.delivery,
        notificationId: notification.id,
      };
      const deliveryRows = await db
        .insert(notificationDeliveries)
        .values([deliveryInput])
        .returning();
      const delivery = deliveryRows[0];

      if (!delivery) {
        throw new Error('Failed to insert notification delivery');
      }

      notificationRoutes.push({ notification, delivery });
    }

    const deliveries =
      deliveryInputs.length > 0
        ? await db.insert(notificationDeliveries).values(deliveryInputs).returning()
        : [];

    return {
      notificationRoutes,
      deliveries: [...notificationRoutes.map((route) => route.delivery), ...deliveries],
    };
  }

  async createDeliveries(
    inputs: readonly CreateNotificationDeliveryRecordInput[],
  ): Promise<NotificationDeliveryRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.#db
      .insert(notificationDeliveries)
      .values([...inputs])
      .returning();
  }

  async listNotifications(input: ListNotificationsInput): Promise<NotificationRecord[]> {
    const cursorFilter =
      input.before && input.beforeId
        ? or(
            lt(notifications.createdAt, input.before),
            and(eq(notifications.createdAt, input.before), lt(notifications.id, input.beforeId)),
          )
        : input.before
          ? lt(notifications.createdAt, input.before)
          : undefined;
    const filters = [
      eq(notifications.workspaceId, input.workspaceId),
      eq(notifications.recipientUserId, input.recipientUserId),
      input.unreadOnly ? isNull(notifications.readAt) : undefined,
      cursorFilter,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

    return this.#db
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(input.limit);
  }

  async countUnread(input: CountUnreadNotificationsInput): Promise<number> {
    const rows = await this.#db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, input.workspaceId),
          eq(notifications.recipientUserId, input.recipientUserId),
          isNull(notifications.readAt),
        ),
      );

    return rows[0]?.value ?? 0;
  }

  async markRead(input: MarkNotificationReadInput): Promise<NotificationRecord | undefined> {
    const rows = await this.#db
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, ${input.readAt})` })
      .where(
        and(
          eq(notifications.workspaceId, input.workspaceId),
          eq(notifications.recipientUserId, input.recipientUserId),
          eq(notifications.id, input.notificationId),
        ),
      )
      .returning();

    return rows[0];
  }

  async markAllRead(input: MarkAllNotificationsReadInput): Promise<number> {
    const rows = await this.#db
      .update(notifications)
      .set({ readAt: input.readAt })
      .where(
        and(
          eq(notifications.workspaceId, input.workspaceId),
          eq(notifications.recipientUserId, input.recipientUserId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    return rows.length;
  }
}

async function insertNotification(
  db: RouteWriteDb,
  input: CreateNotificationRecordInput,
): Promise<NotificationRecord> {
  const rows = await db.insert(notifications).values(input).returning();
  const row = rows[0];

  if (!row) {
    throw new Error('Failed to insert notification');
  }

  return row;
}
