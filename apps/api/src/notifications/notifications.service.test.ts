import type { NotificationPreferenceRecord, NotificationRecord } from '@materiabill/db';
import { Logger, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { UnconfiguredNotificationEmailAdapter } from './notification-email.adapter.js';
import { NotificationsService } from './notifications.service.js';
import type { CreateNotificationRoutesInput } from './notifications.types.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const userId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

const notificationRow: NotificationRecord = {
  id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
  workspaceId,
  recipientUserId: userId,
  eventType: 'draw.approved',
  title: 'Draw approved',
  body: 'Client approved draw D-104',
  resourceType: 'draw',
  resourceId: 'draw-104',
  payload: {},
  readAt: null,
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
};

function preference(eventType = 'draw.approved', channel = 'in_app', enabled = true) {
  return {
    id: `${eventType}-${channel}`,
    workspaceId,
    eventType,
    channel,
    enabled,
    createdAt: new Date('2026-07-01T12:00:00.000Z'),
    updatedAt: new Date('2026-07-01T12:00:00.000Z'),
  } as NotificationPreferenceRecord;
}

function createService() {
  const attemptedAt = new Date('2026-07-01T12:01:00.000Z');
  const repository = {
    findMissingActiveRecipientIds: vi.fn().mockResolvedValue([]),
    listPreferences: vi
      .fn()
      .mockResolvedValue([
        preference('draw.approved', 'in_app', true),
        preference('draw.approved', 'email', true),
        preference('draw.approved', 'whatsapp', false),
      ]),
    replacePreferences: vi.fn().mockResolvedValue([]),
    createNotificationRoutes: vi.fn().mockImplementation((input: CreateNotificationRoutesInput) => {
      const notificationRoutes = input.notifications.map((route, index) => {
        const notification = {
          ...notificationRow,
          ...route.notification,
          id:
            index === 0 ? notificationRow.id : `01890f8e-5f47-7cc3-98c4-dc0c0c0739${String(index)}`,
        };

        return {
          notification,
          delivery: {
            ...route.delivery,
            id: `in-app-delivery-${String(index + 1)}`,
            notificationId: notification.id,
            createdAt: attemptedAt,
          },
        };
      });
      const deliveries = input.deliveries.map((delivery, index) => ({
        ...delivery,
        id: `delivery-${String(index + 1)}`,
        createdAt: attemptedAt,
      }));

      return Promise.resolve({
        notificationRoutes,
        deliveries: [...notificationRoutes.map((route) => route.delivery), ...deliveries],
      });
    }),
    updateDeliveryAttempt: vi.fn().mockImplementation((input) =>
      Promise.resolve({
        id: input.deliveryId,
        workspaceId: input.workspaceId,
        notificationId: null,
        recipientUserId: userId,
        eventType: 'draw.approved',
        channel: 'email',
        status: input.status,
        recipientAddress: 'pm@example.com',
        providerMessageId: input.providerMessageId,
        skippedReason: input.skippedReason,
        errorMessage: input.errorMessage,
        attemptedAt,
        createdAt: attemptedAt,
      }),
    ),
    listNotifications: vi.fn().mockResolvedValue([notificationRow]),
    countUnread: vi.fn().mockResolvedValue(1),
    markRead: vi
      .fn()
      .mockResolvedValue({ ...notificationRow, readAt: new Date('2026-07-01T12:05:00.000Z') }),
    markAllRead: vi.fn().mockResolvedValue(2),
  };
  const emailAdapter = {
    send: vi.fn().mockResolvedValue({
      status: 'skipped',
      providerMessageId: null,
      skippedReason: 'email.provider_unconfigured',
      errorMessage: null,
    }),
  };
  const realtimePublisher = { publish: vi.fn() };
  const auditService = { recordEvent: vi.fn().mockResolvedValue(undefined) };

  return {
    repository,
    emailAdapter,
    realtimePublisher,
    auditService,
    service: new NotificationsService(
      repository as never,
      emailAdapter,
      realtimePublisher as never,
      auditService as never,
    ),
  };
}

describe('NotificationsService', () => {
  it('routes enabled in-app and email channels, publishes realtime, and audits the batch', async () => {
    const { repository, emailAdapter, realtimePublisher, auditService, service } = createService();

    await service.routeEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'draw.approved',
      title: 'Draw approved',
      body: 'Client approved draw D-104',
      resourceType: 'draw',
      resourceId: 'draw-104',
      recipients: [{ userId, email: 'pm@example.com' }],
      channels: ['in_app', 'email'],
    });

    expect(repository.findMissingActiveRecipientIds).toHaveBeenCalledWith(workspaceId, [userId]);
    expect(emailAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'pm@example.com', subject: 'Draw approved' }),
    );
    expect(repository.createNotificationRoutes).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          notification: expect.objectContaining({
            workspaceId,
            recipientUserId: userId,
            eventType: 'draw.approved',
          }),
          delivery: expect.objectContaining({ channel: 'in_app', status: 'sent' }),
        }),
      ],
      deliveries: [
        expect.objectContaining({
          channel: 'email',
          status: 'placeholder',
          skippedReason: 'email.pending',
        }),
      ],
    });
    expect(repository.createNotificationRoutes.mock.invocationCallOrder[0]).toBeLessThan(
      emailAdapter.send.mock.invocationCallOrder[0] ?? 0,
    );
    expect(repository.updateDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        status: 'skipped',
        skippedReason: 'email.provider_unconfigured',
      }),
    );
    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        type: 'notifications.changed',
        payload: expect.objectContaining({ recipientUserId: userId }),
      }),
    );
    expect(auditService.recordEvent).toHaveBeenCalledTimes(1);
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        actorUserId: userId,
        audience: 'internal',
        action: 'notification.routed',
      }),
    );
  });

  it('rejects routing to recipients without active workspace membership before sending', async () => {
    const { repository, emailAdapter, service } = createService();
    const outsideUserId = '708d71fe-8bc4-4027-bfb5-cfe41c033eb2';
    repository.findMissingActiveRecipientIds.mockResolvedValueOnce([outsideUserId]);

    await expect(
      service.routeEvent({
        workspaceId,
        actorUserId: userId,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        recipients: [{ userId: outsideUserId, email: 'outside@example.com' }],
        channels: ['email'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.listPreferences).not.toHaveBeenCalled();
    expect(emailAdapter.send).not.toHaveBeenCalled();
    expect(repository.createNotificationRoutes).not.toHaveBeenCalled();
  });

  it('records failed email delivery without blocking in-app notification delivery', async () => {
    const { repository, emailAdapter, realtimePublisher, auditService, service } = createService();
    emailAdapter.send.mockRejectedValueOnce(new Error('smtp offline'));

    await service.routeEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'draw.approved',
      title: 'Draw approved',
      body: 'Client approved draw D-104',
      resourceType: 'draw',
      recipients: [{ userId, email: 'pm@example.com' }],
      channels: ['in_app', 'email'],
    });

    expect(repository.createNotificationRoutes).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          notification: expect.objectContaining({ recipientUserId: userId }),
          delivery: expect.objectContaining({ channel: 'in_app', status: 'sent' }),
        }),
      ],
      deliveries: [
        expect.objectContaining({
          channel: 'email',
          status: 'placeholder',
          skippedReason: 'email.pending',
        }),
      ],
    });
    expect(repository.updateDeliveryAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        status: 'failed',
        errorMessage: 'smtp offline',
      }),
    );
    expect(realtimePublisher.publish).toHaveBeenCalledTimes(1);
    expect(auditService.recordEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps the email attempt result when delivery update persistence fails', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementationOnce(() => undefined);
    const { repository, emailAdapter, auditService, service } = createService();
    emailAdapter.send.mockResolvedValueOnce({
      status: 'sent',
      providerMessageId: 'provider-message-1',
      skippedReason: null,
      errorMessage: null,
    });
    repository.updateDeliveryAttempt.mockRejectedValueOnce(new Error('delivery update failed'));

    await expect(
      service.routeEvent({
        workspaceId,
        actorUserId: userId,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        resourceId: 'draw-104',
        recipients: [{ userId, email: 'pm@example.com' }],
        channels: ['email'],
      }),
    ).resolves.toEqual({
      deliveries: [
        expect.objectContaining({
          channel: 'email',
          status: 'sent',
          providerMessageId: 'provider-message-1',
          skippedReason: null,
          errorMessage: null,
        }),
      ],
    });

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { 'email.sent': 1 },
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith('delivery update failed');
    warnSpy.mockRestore();
  });

  it('skips disabled email preferences without calling the adapter', async () => {
    const { repository, emailAdapter, service } = createService();
    repository.listPreferences.mockResolvedValue([
      preference('draw.approved', 'in_app', true),
      preference('draw.approved', 'email', false),
      preference('draw.approved', 'whatsapp', false),
    ]);

    await service.routeEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'draw.approved',
      title: 'Draw approved',
      body: 'Client approved draw D-104',
      resourceType: 'draw',
      recipients: [{ userId, email: 'pm@example.com' }],
      channels: ['email'],
    });

    expect(emailAdapter.send).not.toHaveBeenCalled();
    expect(repository.createNotificationRoutes).toHaveBeenCalledWith({
      notifications: [],
      deliveries: [
        expect.objectContaining({
          channel: 'email',
          status: 'skipped',
          skippedReason: 'preference.disabled',
        }),
      ],
    });
  });

  it('records WhatsApp as a placeholder even when requested', async () => {
    const { repository, service } = createService();

    await service.routeEvent({
      workspaceId,
      actorUserId: userId,
      eventType: 'draw.approved',
      title: 'Draw approved',
      body: 'Client approved draw D-104',
      resourceType: 'draw',
      recipients: [{ userId, phone: '+966500000000' }],
      channels: ['whatsapp'],
    });

    expect(repository.createNotificationRoutes).toHaveBeenCalledWith({
      notifications: [],
      deliveries: [
        expect.objectContaining({
          channel: 'whatsapp',
          status: 'placeholder',
          skippedReason: 'whatsapp.v1_5',
        }),
      ],
    });
  });

  it('does not publish realtime when delivery persistence fails during routing', async () => {
    const { repository, realtimePublisher, auditService, service } = createService();
    repository.createNotificationRoutes.mockRejectedValueOnce(new Error('delivery insert failed'));

    await expect(
      service.routeEvent({
        workspaceId,
        actorUserId: userId,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        resourceId: 'draw-104',
        recipients: [{ userId }],
        channels: ['in_app'],
      }),
    ).rejects.toThrow('delivery insert failed');

    expect(realtimePublisher.publish).not.toHaveBeenCalled();
    expect(auditService.recordEvent).not.toHaveBeenCalled();
  });

  it('publishes realtime and does not fail routing when audit recording fails', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementationOnce(() => undefined);
    const { realtimePublisher, auditService, service } = createService();
    auditService.recordEvent.mockRejectedValueOnce(new Error('audit write failed'));

    await expect(
      service.routeEvent({
        workspaceId,
        actorUserId: userId,
        eventType: 'draw.approved',
        title: 'Draw approved',
        body: 'Client approved draw D-104',
        resourceType: 'draw',
        resourceId: 'draw-104',
        recipients: [{ userId }],
        channels: ['in_app'],
      }),
    ).resolves.toEqual({
      deliveries: [expect.objectContaining({ channel: 'in_app', status: 'sent' })],
    });

    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        type: 'notifications.changed',
        payload: expect.objectContaining({ recipientUserId: userId }),
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith('audit write failed');
    warnSpy.mockRestore();
  });

  it('parses notification list queries and scopes them to the current user', async () => {
    const { repository, service } = createService();

    await expect(
      service.listCurrentUserNotifications({
        workspaceId,
        recipientUserId: userId,
        query: {
          unreadOnly: 'true',
          limit: '25',
          before: '2026-07-01T11:00:00.000Z',
          beforeId: notificationRow.id,
        },
      }),
    ).resolves.toEqual({
      notifications: [
        expect.objectContaining({
          id: notificationRow.id,
          workspaceId,
          recipientUserId: userId,
          readAt: null,
          createdAt: '2026-07-01T12:00:00.000Z',
        }),
      ],
    });

    expect(repository.listNotifications).toHaveBeenCalledWith({
      workspaceId,
      recipientUserId: userId,
      unreadOnly: true,
      before: new Date('2026-07-01T11:00:00.000Z'),
      beforeId: notificationRow.id,
      limit: 25,
    });
  });

  it('returns the unread count for the current user scope', async () => {
    const { repository, service } = createService();

    await expect(
      service.getUnreadCount({
        workspaceId,
        recipientUserId: userId,
      }),
    ).resolves.toEqual({ unreadCount: 1 });

    expect(repository.countUnread).toHaveBeenCalledWith({
      workspaceId,
      recipientUserId: userId,
    });
  });

  it('lists preferences with WhatsApp marked unavailable', async () => {
    const { repository, service } = createService();

    await expect(service.listPreferences(workspaceId)).resolves.toEqual({
      preferences: [
        {
          eventType: 'draw.approved',
          channel: 'in_app',
          enabled: true,
          available: true,
        },
        {
          eventType: 'draw.approved',
          channel: 'email',
          enabled: true,
          available: true,
        },
        {
          eventType: 'draw.approved',
          channel: 'whatsapp',
          enabled: false,
          available: false,
        },
      ],
    });

    expect(repository.listPreferences).toHaveBeenCalledWith(workspaceId);
  });

  it('replaces preferences for the current workspace and preserves WhatsApp availability=false', async () => {
    const { repository, service } = createService();
    repository.replacePreferences.mockResolvedValueOnce([
      preference('draw.approved', 'in_app', false),
      preference('draw.approved', 'email', true),
      preference('draw.approved', 'whatsapp', false),
    ]);

    await expect(
      service.replacePreferences({
        workspaceId,
        body: {
          preferences: [
            { eventType: 'draw.approved', channel: 'in_app', enabled: false },
            { eventType: 'draw.approved', channel: 'email', enabled: true },
            { eventType: 'draw.approved', channel: 'whatsapp', enabled: false },
          ],
        },
      }),
    ).resolves.toEqual({
      preferences: [
        {
          eventType: 'draw.approved',
          channel: 'in_app',
          enabled: false,
          available: true,
        },
        {
          eventType: 'draw.approved',
          channel: 'email',
          enabled: true,
          available: true,
        },
        {
          eventType: 'draw.approved',
          channel: 'whatsapp',
          enabled: false,
          available: false,
        },
      ],
    });

    expect(repository.replacePreferences).toHaveBeenCalledWith({
      workspaceId,
      preferences: [
        { eventType: 'draw.approved', channel: 'in_app', enabled: false },
        { eventType: 'draw.approved', channel: 'email', enabled: true },
        { eventType: 'draw.approved', channel: 'whatsapp', enabled: false },
      ],
    });
  });

  it('rejects enabling WhatsApp preferences through service validation', async () => {
    const { repository, service } = createService();

    await expect(
      service.replacePreferences({
        workspaceId,
        body: {
          preferences: [{ eventType: 'draw.approved', channel: 'whatsapp', enabled: true }],
        },
      }),
    ).rejects.toThrow(/whatsapp/i);

    expect(repository.replacePreferences).not.toHaveBeenCalled();
  });

  it('publishes realtime changes when marking a notification read', async () => {
    const { realtimePublisher, service } = createService();

    await expect(
      service.markRead({
        workspaceId,
        recipientUserId: userId,
        notificationId: notificationRow.id,
      }),
    ).resolves.toEqual({
      notification: expect.objectContaining({
        id: notificationRow.id,
        readAt: '2026-07-01T12:05:00.000Z',
      }),
    });

    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        type: 'notifications.changed',
        payload: {
          recipientUserId: userId,
          notificationId: notificationRow.id,
        },
      }),
    );
  });

  it('returns already-read current-user notifications without treating them as missing', async () => {
    const { repository, realtimePublisher, service } = createService();
    repository.markRead.mockResolvedValueOnce({
      ...notificationRow,
      readAt: new Date('2026-07-01T12:03:00.000Z'),
    });

    await expect(
      service.markRead({
        workspaceId,
        recipientUserId: userId,
        notificationId: notificationRow.id,
      }),
    ).resolves.toEqual({
      notification: expect.objectContaining({
        id: notificationRow.id,
        readAt: '2026-07-01T12:03:00.000Z',
      }),
    });

    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        type: 'notifications.changed',
        payload: {
          recipientUserId: userId,
          notificationId: notificationRow.id,
        },
      }),
    );
  });

  it('throws NotFoundException when marking a missing notification read', async () => {
    const { repository, service } = createService();
    repository.markRead.mockResolvedValue(undefined);

    await expect(
      service.markRead({
        workspaceId,
        recipientUserId: userId,
        notificationId: notificationRow.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('publishes realtime changes when marking all notifications read', async () => {
    const { realtimePublisher, service } = createService();

    await expect(
      service.markAllRead({
        workspaceId,
        recipientUserId: userId,
      }),
    ).resolves.toEqual({ updatedCount: 2 });

    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        type: 'notifications.changed',
        payload: {
          recipientUserId: userId,
          updatedCount: 2,
        },
      }),
    );
  });

  it('does not publish realtime changes when no notifications were marked read', async () => {
    const { realtimePublisher, repository, service } = createService();
    repository.markAllRead.mockResolvedValueOnce(0);

    await expect(
      service.markAllRead({
        workspaceId,
        recipientUserId: userId,
      }),
    ).resolves.toEqual({ updatedCount: 0 });

    expect(realtimePublisher.publish).not.toHaveBeenCalled();
  });

  it('default email adapter records provider-unconfigured skips', async () => {
    const adapter = new UnconfiguredNotificationEmailAdapter();

    await expect(
      adapter.send({
        workspaceId,
        eventType: 'draw.approved',
        to: 'pm@example.com',
        subject: 'Draw approved',
        body: 'Client approved draw D-104',
        payload: {},
      }),
    ).resolves.toEqual({
      status: 'skipped',
      providerMessageId: null,
      skippedReason: 'email.provider_unconfigured',
      errorMessage: null,
    });
  });
});
