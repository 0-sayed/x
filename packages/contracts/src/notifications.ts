import { z } from 'zod';

const payloadSchema = z.record(z.string(), z.unknown());

const queryBooleanSchema = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.boolean());

export const notificationEventTypeSchema = z.enum([
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
]);

export const notificationChannelSchema = z.enum(['in_app', 'email', 'whatsapp']);

export const notificationDeliveryStatusSchema = z.enum([
  'sent',
  'skipped',
  'failed',
  'placeholder',
]);

const notificationRecipientSchema = z
  .object({
    userId: z.uuid(),
    email: z.email().optional(),
    phone: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const notificationPreferenceUpdateSchema = z
  .object({
    eventType: notificationEventTypeSchema,
    channel: notificationChannelSchema,
    enabled: z.boolean(),
  })
  .strict()
  .superRefine((preference, context) => {
    if (preference.channel === 'whatsapp' && preference.enabled) {
      context.addIssue({
        code: 'custom',
        message: 'WhatsApp cannot be enabled at launch',
        path: ['enabled'],
      });
    }
  });

export const routeNotificationEventInputSchema = z
  .object({
    workspaceId: z.uuid(),
    actorUserId: z.uuid().nullable(),
    eventType: notificationEventTypeSchema,
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(500),
    resourceType: z.string().trim().min(1).max(80),
    resourceId: z.string().trim().min(1).max(120).nullable().optional(),
    payload: payloadSchema.optional(),
    recipients: z.array(notificationRecipientSchema).min(1).max(100),
    channels: z.array(notificationChannelSchema).min(1).default(['in_app', 'email']),
  })
  .strict()
  .superRefine((input, context) => {
    const recipientUserIds = new Set<string>();
    input.recipients.forEach((recipient, index) => {
      if (recipientUserIds.has(recipient.userId)) {
        context.addIssue({
          code: 'custom',
          message: 'Recipient userId must be unique',
          path: ['recipients', index, 'userId'],
        });
        return;
      }

      recipientUserIds.add(recipient.userId);
    });

    const channels = new Set<string>();
    input.channels.forEach((channel, index) => {
      if (channels.has(channel)) {
        context.addIssue({
          code: 'custom',
          message: 'Channel must be unique',
          path: ['channels', index],
        });
        return;
      }

      channels.add(channel);
    });
  });

export const notificationSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    recipientUserId: z.uuid(),
    eventType: notificationEventTypeSchema,
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    resourceType: z.string().trim().min(1),
    resourceId: z.string().trim().min(1).nullable(),
    payload: payloadSchema.default({}),
    readAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const notificationListQuerySchema = z
  .object({
    unreadOnly: queryBooleanSchema.default(false),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.iso.datetime().optional(),
    beforeId: z.uuid().optional(),
  })
  .strict()
  .refine((query) => query.before !== undefined || query.beforeId === undefined, {
    message: 'beforeId requires before',
    path: ['beforeId'],
  });

export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationSchema),
  })
  .strict();

export const notificationUnreadCountResponseSchema = z
  .object({
    unreadCount: z.number().int().nonnegative(),
  })
  .strict();

export const markNotificationReadResponseSchema = z
  .object({
    notification: notificationSchema,
  })
  .strict();

export const markAllNotificationsReadResponseSchema = z
  .object({
    updatedCount: z.number().int().nonnegative(),
  })
  .strict();

export const notificationPreferenceSchema = z
  .object({
    eventType: notificationEventTypeSchema,
    channel: notificationChannelSchema,
    enabled: z.boolean(),
    available: z.boolean(),
  })
  .strict();

export const notificationPreferencesResponseSchema = z
  .object({
    preferences: z.array(notificationPreferenceSchema),
  })
  .strict();

export const replaceNotificationPreferencesRequestSchema = z
  .object({
    preferences: z.array(notificationPreferenceUpdateSchema),
  })
  .strict()
  .superRefine((input, context) => {
    const preferenceKeys = new Set<string>();
    input.preferences.forEach((preference, index) => {
      const key = `${preference.eventType}:${preference.channel}`;
      if (preferenceKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Preference eventType/channel pair must be unique',
          path: ['preferences', index],
        });
        return;
      }

      preferenceKeys.add(key);
    });
  });

export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationDeliveryStatus = z.infer<typeof notificationDeliveryStatusSchema>;
export type RouteNotificationEventInput = z.infer<typeof routeNotificationEventInputSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type ReplaceNotificationPreferencesRequest = z.infer<
  typeof replaceNotificationPreferencesRequestSchema
>;
