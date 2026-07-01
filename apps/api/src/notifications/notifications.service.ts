import {
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationPreferencesResponseSchema,
  notificationSchema,
  notificationUnreadCountResponseSchema,
  replaceNotificationPreferencesRequestSchema,
  routeNotificationEventInputSchema,
  type NotificationChannel,
  type NotificationDeliveryStatus,
  type NotificationEventType,
  type RouteNotificationEventInput,
} from '@materiabill/contracts';
import type {
  NotificationDeliveryRecord,
  NotificationPreferenceRecord,
  NotificationRecord,
} from '@materiabill/db';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import {
  NOTIFICATION_EMAIL_ADAPTER,
  type NotificationEmailAdapter,
} from './notification-email.adapter.js';
import { NotificationsRepository } from './notifications.repository.js';
import type {
  CreateNotificationDeliveryRecordInput,
  CreateNotificationWithDeliveryInput,
} from './notifications.types.js';

type RouteEventResult = {
  readonly deliveries: readonly NotificationDeliveryRecord[];
};

type CurrentUserInput = {
  readonly workspaceId: string;
  readonly recipientUserId: string;
};

type ListCurrentUserNotificationsInput = CurrentUserInput & {
  readonly query: unknown;
};

type MarkReadInput = CurrentUserInput & {
  readonly notificationId: string;
};

type ReplacePreferencesInput = {
  readonly workspaceId: string;
  readonly body: unknown;
};

@Injectable()
export class NotificationsService {
  readonly #logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    @Inject(NOTIFICATION_EMAIL_ADAPTER)
    private readonly emailAdapter: NotificationEmailAdapter,
    private readonly realtimePublisher: RealtimePublisher,
    private readonly auditService: AuditService,
  ) {}

  async routeEvent(input: RouteNotificationEventInput): Promise<RouteEventResult> {
    const parsed = routeNotificationEventInputSchema.parse(input);
    const attemptedAt = new Date();
    const missingRecipientIds = await this.repository.findMissingActiveRecipientIds(
      parsed.workspaceId,
      parsed.recipients.map((recipient) => recipient.userId),
    );

    if (missingRecipientIds.length > 0) {
      throw new NotFoundException('Notification recipient not found');
    }

    const preferences = toPreferenceMap(await this.repository.listPreferences(parsed.workspaceId));
    const notificationRoutes: CreateNotificationWithDeliveryInput[] = [];
    const deliveries: CreateNotificationDeliveryRecordInput[] = [];

    for (const recipient of parsed.recipients) {
      for (const channel of parsed.channels) {
        const enabled =
          preferences.get(preferenceKey(parsed.eventType, channel)) ?? defaultEnabled(channel);

        if (channel === 'whatsapp') {
          deliveries.push(
            toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: 'placeholder',
              recipientAddress: recipient.phone ?? null,
              providerMessageId: null,
              skippedReason: 'whatsapp.v1_5',
              errorMessage: null,
              attemptedAt,
            }),
          );
          continue;
        }

        if (!enabled) {
          deliveries.push(
            toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: 'skipped',
              recipientAddress: channel === 'email' ? (recipient.email ?? null) : null,
              providerMessageId: null,
              skippedReason: 'preference.disabled',
              errorMessage: null,
              attemptedAt,
            }),
          );
          continue;
        }

        if (channel === 'in_app') {
          notificationRoutes.push({
            notification: {
              workspaceId: parsed.workspaceId,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              title: parsed.title,
              body: parsed.body,
              resourceType: parsed.resourceType,
              resourceId: parsed.resourceId ?? null,
              payload: parsed.payload ?? {},
            },
            delivery: toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: 'sent',
              recipientAddress: null,
              providerMessageId: null,
              skippedReason: null,
              errorMessage: null,
              attemptedAt,
            }),
          });
          continue;
        }

        if (!recipient.email) {
          deliveries.push(
            toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: 'skipped',
              recipientAddress: null,
              providerMessageId: null,
              skippedReason: 'recipient.email_missing',
              errorMessage: null,
              attemptedAt,
            }),
          );
          continue;
        }

        try {
          const result = await this.emailAdapter.send({
            workspaceId: parsed.workspaceId,
            eventType: parsed.eventType,
            to: recipient.email,
            subject: parsed.title,
            body: parsed.body,
            payload: parsed.payload ?? {},
          });

          deliveries.push(
            toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: result.status,
              recipientAddress: recipient.email,
              providerMessageId: result.providerMessageId,
              skippedReason: result.skippedReason,
              errorMessage: result.errorMessage,
              attemptedAt,
            }),
          );
        } catch (error) {
          deliveries.push(
            toDelivery({
              workspaceId: parsed.workspaceId,
              notificationId: null,
              recipientUserId: recipient.userId,
              eventType: parsed.eventType,
              channel,
              status: 'failed',
              recipientAddress: recipient.email,
              providerMessageId: null,
              skippedReason: null,
              errorMessage: error instanceof Error ? error.message : 'Email adapter failed',
              attemptedAt,
            }),
          );
        }
      }
    }

    const createdRoutes = await this.repository.createNotificationRoutes({
      notifications: notificationRoutes,
      deliveries,
    });

    try {
      await this.auditService.recordEvent({
        workspaceId: parsed.workspaceId,
        actorUserId: parsed.actorUserId,
        audience: 'internal',
        action: 'notification.routed',
        resourceType: parsed.resourceType,
        resourceId: parsed.resourceId ?? null,
        metadata: summarizeDeliveries(createdRoutes.deliveries),
      });
    } catch (error) {
      this.#logger.warn(
        error instanceof Error ? error.message : 'Notification audit recording failed',
      );
    }

    for (const route of createdRoutes.notificationRoutes) {
      this.realtimePublisher.publish({
        workspaceId: parsed.workspaceId,
        type: 'notifications.changed',
        payload: {
          recipientUserId: route.notification.recipientUserId,
          notificationId: route.notification.id,
          eventType: route.notification.eventType,
        },
      });
    }

    return { deliveries: createdRoutes.deliveries };
  }

  async listCurrentUserNotifications(input: ListCurrentUserNotificationsInput) {
    const query = notificationListQuerySchema.parse(input.query);
    const rows = await this.repository.listNotifications({
      workspaceId: input.workspaceId,
      recipientUserId: input.recipientUserId,
      unreadOnly: query.unreadOnly,
      before: query.before ? new Date(query.before) : undefined,
      beforeId: query.beforeId,
      limit: query.limit,
    });

    return notificationListResponseSchema.parse({
      notifications: rows.map((row) => toNotification(row)),
    });
  }

  async getUnreadCount(input: CurrentUserInput) {
    return notificationUnreadCountResponseSchema.parse({
      unreadCount: await this.repository.countUnread(input),
    });
  }

  async markRead(input: MarkReadInput) {
    const row = await this.repository.markRead({
      workspaceId: input.workspaceId,
      recipientUserId: input.recipientUserId,
      notificationId: input.notificationId,
      readAt: new Date(),
    });

    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    this.realtimePublisher.publish({
      workspaceId: input.workspaceId,
      type: 'notifications.changed',
      payload: {
        recipientUserId: input.recipientUserId,
        notificationId: input.notificationId,
      },
    });

    return markNotificationReadResponseSchema.parse({
      notification: toNotification(row),
    });
  }

  async markAllRead(input: CurrentUserInput) {
    const updatedCount = await this.repository.markAllRead({
      workspaceId: input.workspaceId,
      recipientUserId: input.recipientUserId,
      readAt: new Date(),
    });

    if (updatedCount > 0) {
      this.realtimePublisher.publish({
        workspaceId: input.workspaceId,
        type: 'notifications.changed',
        payload: {
          recipientUserId: input.recipientUserId,
          updatedCount,
        },
      });
    }

    return markAllNotificationsReadResponseSchema.parse({ updatedCount });
  }

  async listPreferences(workspaceId: string) {
    return notificationPreferencesResponseSchema.parse({
      preferences: (await this.repository.listPreferences(workspaceId)).map((row) => ({
        eventType: row.eventType,
        channel: row.channel,
        enabled: row.enabled,
        available: row.channel !== 'whatsapp',
      })),
    });
  }

  async replacePreferences(input: ReplacePreferencesInput) {
    const body = replaceNotificationPreferencesRequestSchema.parse(input.body);
    const rows = await this.repository.replacePreferences({
      workspaceId: input.workspaceId,
      preferences: body.preferences,
    });

    return notificationPreferencesResponseSchema.parse({
      preferences: rows.map((row) => ({
        eventType: row.eventType,
        channel: row.channel,
        enabled: row.enabled,
        available: row.channel !== 'whatsapp',
      })),
    });
  }
}

function toNotification(row: NotificationRecord) {
  return notificationSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    recipientUserId: row.recipientUserId,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    payload: row.payload,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

function defaultEnabled(channel: NotificationChannel): boolean {
  return channel !== 'whatsapp';
}

function preferenceKey(eventType: NotificationEventType, channel: NotificationChannel): string {
  return `${eventType}:${channel}`;
}

function toPreferenceMap(rows: readonly NotificationPreferenceRecord[]): Map<string, boolean> {
  return new Map(rows.map((row) => [preferenceKey(row.eventType, row.channel), row.enabled]));
}

function toDelivery(
  input: CreateNotificationDeliveryRecordInput,
): CreateNotificationDeliveryRecordInput {
  return input;
}

function summarizeDeliveries(
  deliveries: readonly {
    readonly channel: NotificationChannel;
    readonly status: NotificationDeliveryStatus;
  }[],
): Record<string, number> {
  return deliveries.reduce<Record<string, number>>((summary, delivery) => {
    const key = `${delivery.channel}.${delivery.status}`;
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}
