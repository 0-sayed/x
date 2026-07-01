import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationEventType,
  ReplaceNotificationPreferencesRequest,
} from '@materiabill/contracts';
import type { NotificationDeliveryRecord, NotificationRecord } from '@materiabill/db';

type NotificationPayload = Record<string, unknown>;

export type CreateNotificationRecordInput = {
  readonly workspaceId: string;
  readonly recipientUserId: string;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly payload: NotificationPayload;
};

export type CreateNotificationDeliveryRecordInput = {
  readonly workspaceId: string;
  readonly notificationId: string | null;
  readonly recipientUserId: string | null;
  readonly eventType: NotificationEventType;
  readonly channel: NotificationChannel;
  readonly status: NotificationDeliveryStatus;
  readonly recipientAddress: string | null;
  readonly providerMessageId: string | null;
  readonly skippedReason: string | null;
  readonly errorMessage: string | null;
  readonly attemptedAt: Date;
};

export type CreateNotificationWithDeliveryInput = {
  readonly notification: CreateNotificationRecordInput;
  readonly delivery: Omit<CreateNotificationDeliveryRecordInput, 'notificationId'>;
};

export type CreateNotificationRoutesInput = {
  readonly notifications: readonly CreateNotificationWithDeliveryInput[];
  readonly deliveries: readonly CreateNotificationDeliveryRecordInput[];
};

export type CreateNotificationRoutesResult = {
  readonly notificationRoutes: readonly {
    readonly notification: NotificationRecord;
    readonly delivery: NotificationDeliveryRecord;
  }[];
  readonly deliveries: readonly NotificationDeliveryRecord[];
};

export type ListNotificationsInput = {
  readonly workspaceId: string;
  readonly recipientUserId: string;
  readonly unreadOnly?: boolean;
  readonly before?: Date;
  readonly beforeId?: string;
  readonly limit: number;
};

export type CountUnreadNotificationsInput = {
  readonly workspaceId: string;
  readonly recipientUserId: string;
};

export type MarkNotificationReadInput = CountUnreadNotificationsInput & {
  readonly notificationId: string;
  readonly readAt: Date;
};

export type MarkAllNotificationsReadInput = CountUnreadNotificationsInput & {
  readonly readAt: Date;
};

export type UpdateNotificationDeliveryAttemptInput = {
  readonly workspaceId: string;
  readonly deliveryId: string;
  readonly status: NotificationDeliveryStatus;
  readonly providerMessageId: string | null;
  readonly skippedReason: string | null;
  readonly errorMessage: string | null;
};

export type ReplaceNotificationPreferencesInput = {
  readonly workspaceId: string;
  readonly preferences: ReplaceNotificationPreferencesRequest['preferences'];
};
