import { describe, expect, it } from 'vitest';

import {
  markAllNotificationsReadResponseSchema,
  markNotificationReadResponseSchema,
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationPreferencesResponseSchema,
  notificationUnreadCountResponseSchema,
  replaceNotificationPreferencesRequestSchema,
  routeNotificationEventInputSchema,
} from './notifications.js';
import { realtimeEventTypeSchema } from './realtime.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const userId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

describe('notification contracts', () => {
  it('accepts a route event with launch notification event types', () => {
    expect(
      routeNotificationEventInputSchema.parse({
        workspaceId,
        actorUserId: userId,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        resourceId: 'draw-104',
        payload: { drawId: 'draw-104' },
        recipients: [{ userId, email: 'pm@example.com' }],
        channels: ['in_app', 'email'],
      }),
    ).toMatchObject({
      eventType: 'draw.approved',
      channels: ['in_app', 'email'],
    });
  });

  it('defaults route channels to in-app and email', () => {
    expect(
      routeNotificationEventInputSchema.parse({
        workspaceId,
        actorUserId: null,
        eventType: 'invite.accepted',
        title: 'Invite accepted',
        body: 'A client accepted the invite',
        resourceType: 'invite',
        recipients: [{ userId }],
      }).channels,
    ).toEqual(['in_app', 'email']);
  });

  it('rejects duplicate route recipients and channels', () => {
    expect(() =>
      routeNotificationEventInputSchema.parse({
        workspaceId,
        actorUserId: null,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        recipients: [{ userId }, { userId }],
        channels: ['email', 'email'],
      }),
    ).toThrow();
  });

  it('rejects enabling WhatsApp preferences at launch', () => {
    expect(() =>
      replaceNotificationPreferencesRequestSchema.parse({
        preferences: [
          {
            eventType: 'document.signed',
            channel: 'whatsapp',
            enabled: true,
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate preference event/channel pairs', () => {
    expect(() =>
      replaceNotificationPreferencesRequestSchema.parse({
        preferences: [
          { eventType: 'draw.approved', channel: 'email', enabled: true },
          { eventType: 'draw.approved', channel: 'email', enabled: false },
        ],
      }),
    ).toThrow();
  });

  it('accepts disabled WhatsApp preferences and marks the channel unavailable', () => {
    expect(
      notificationPreferencesResponseSchema.parse({
        preferences: [
          {
            eventType: 'document.signed',
            channel: 'whatsapp',
            enabled: false,
            available: false,
          },
        ],
      }).preferences[0],
    ).toEqual({
      eventType: 'document.signed',
      channel: 'whatsapp',
      enabled: false,
      available: false,
    });
  });

  it('accepts notification list, unread count, and read responses', () => {
    const notification = {
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId,
      recipientUserId: userId,
      eventType: 'snag.opened',
      title: 'Snag opened',
      body: 'Kitchen snag opened',
      resourceType: 'snag',
      resourceId: 'snag-1',
      payload: {},
      readAt: null,
      createdAt: '2026-07-01T12:00:00.000Z',
    };

    expect(notificationListQuerySchema.parse({ unreadOnly: 'true', limit: '25' })).toEqual({
      unreadOnly: true,
      limit: 25,
    });
    expect(notificationListResponseSchema.parse({ notifications: [notification] })).toEqual({
      notifications: [notification],
    });
    expect(notificationUnreadCountResponseSchema.parse({ unreadCount: 3 })).toEqual({
      unreadCount: 3,
    });
    expect(
      markNotificationReadResponseSchema.parse({
        notification: { ...notification, readAt: '2026-07-01T12:05:00.000Z' },
      }).notification.readAt,
    ).toBe('2026-07-01T12:05:00.000Z');
    expect(markAllNotificationsReadResponseSchema.parse({ updatedCount: 2 })).toEqual({
      updatedCount: 2,
    });
  });

  it('adds notifications.changed to realtime event types', () => {
    expect(realtimeEventTypeSchema.parse('notifications.changed')).toBe('notifications.changed');
  });
});
