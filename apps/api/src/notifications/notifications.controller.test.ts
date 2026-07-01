import { type CanActivate, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

const workspaceContext: WorkspaceContextValue = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: 'workspace_admin',
    permissions: ['workspace.view', 'settings.view', 'settings.manage_defaults'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

describe('NotificationsController', () => {
  let app: INestApplication;
  let currentWorkspaceContext: WorkspaceContextValue | undefined = workspaceContext;

  const service = {
    listCurrentUserNotifications: vi.fn().mockResolvedValue({ notifications: [] }),
    getUnreadCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
    markRead: vi.fn().mockResolvedValue({
      notification: { id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f' },
    }),
    markAllRead: vi.fn().mockResolvedValue({ updatedCount: 2 }),
    listPreferences: vi.fn().mockResolvedValue({ preferences: [] }),
    replacePreferences: vi.fn().mockResolvedValue({ preferences: [] }),
  };
  const guard: CanActivate = {
    canActivate: (context: ExecutionContext): boolean => {
      const requestValue = context.switchToHttp().getRequest<{
        workspaceContext?: WorkspaceContextValue;
      }>();
      requestValue.workspaceContext = currentWorkspaceContext;

      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    })
      .overrideGuard(WorkspaceContextGuard)
      .useValue(guard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentWorkspaceContext = workspaceContext;
    vi.clearAllMocks();
  });

  it('lists current-user notifications for the resolved workspace', async () => {
    await request(app.getHttpServer()).get('/notifications?unreadOnly=true').expect(200);

    expect(service.listCurrentUserNotifications).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      recipientUserId: workspaceContext.membership.userId,
      query: { unreadOnly: 'true' },
    });
  });

  it('rejects an invalid notifications list query', async () => {
    await request(app.getHttpServer()).get('/notifications?beforeId=not-a-uuid').expect(400);

    expect(service.listCurrentUserNotifications).not.toHaveBeenCalled();
  });

  it('returns current-user unread count', async () => {
    await request(app.getHttpServer()).get('/notifications/unread-count').expect(200);

    expect(service.getUnreadCount).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      recipientUserId: workspaceContext.membership.userId,
    });
  });

  it('marks one current-user notification read', async () => {
    await request(app.getHttpServer())
      .patch('/notifications/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/read')
      .expect(200);

    expect(service.markRead).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      recipientUserId: workspaceContext.membership.userId,
      notificationId: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
    });
  });

  it('rejects an invalid notification id when marking read', async () => {
    await request(app.getHttpServer()).patch('/notifications/not-a-uuid/read').expect(400);

    expect(service.markRead).not.toHaveBeenCalled();
  });

  it('marks all current-user notifications read', async () => {
    await request(app.getHttpServer()).post('/notifications/read-all').expect(201);

    expect(service.markAllRead).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      recipientUserId: workspaceContext.membership.userId,
    });
  });

  it('allows admins to list workspace preferences', async () => {
    await request(app.getHttpServer()).get('/notification-preferences').expect(200);

    expect(service.listPreferences).toHaveBeenCalledWith(workspaceContext.workspace.id);
  });

  it('allows settings viewers to list workspace preferences', async () => {
    currentWorkspaceContext = {
      ...workspaceContext,
      membership: {
        ...workspaceContext.membership,
        isAdmin: false,
        permissions: ['settings.view'],
      },
    };

    await request(app.getHttpServer()).get('/notification-preferences').expect(200);

    expect(service.listPreferences).toHaveBeenCalledWith(workspaceContext.workspace.id);
  });

  it('forbids preference reads without admin or settings permissions', async () => {
    currentWorkspaceContext = {
      ...workspaceContext,
      membership: {
        ...workspaceContext.membership,
        isAdmin: false,
        permissions: ['workspace.view'],
      },
    };

    await request(app.getHttpServer()).get('/notification-preferences').expect(403);

    expect(service.listPreferences).not.toHaveBeenCalled();
  });

  it('allows admins to replace workspace preferences', async () => {
    const body = {
      preferences: [{ eventType: 'draw.approved', channel: 'email', enabled: false }],
    };

    await request(app.getHttpServer()).put('/notification-preferences').send(body).expect(200);

    expect(service.replacePreferences).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      body,
    });
  });

  it('allows settings managers to replace workspace preferences', async () => {
    currentWorkspaceContext = {
      ...workspaceContext,
      membership: {
        ...workspaceContext.membership,
        isAdmin: false,
        permissions: ['settings.manage_defaults'],
      },
    };

    const body = {
      preferences: [{ eventType: 'draw.approved', channel: 'email', enabled: false }],
    };

    await request(app.getHttpServer()).put('/notification-preferences').send(body).expect(200);

    expect(service.replacePreferences).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      body,
    });
  });

  it('forbids preference writes without admin or settings manage permission', async () => {
    currentWorkspaceContext = {
      ...workspaceContext,
      membership: {
        ...workspaceContext.membership,
        isAdmin: false,
        permissions: ['settings.view'],
      },
    };

    await request(app.getHttpServer())
      .put('/notification-preferences')
      .send({
        preferences: [{ eventType: 'draw.approved', channel: 'email', enabled: false }],
      })
      .expect(403);

    expect(service.replacePreferences).not.toHaveBeenCalled();
  });

  it('rejects an invalid preference replacement body', async () => {
    await request(app.getHttpServer())
      .put('/notification-preferences')
      .send({
        preferences: [{ eventType: 'draw.approved', channel: 'whatsapp', enabled: true }],
      })
      .expect(400);

    expect(service.replacePreferences).not.toHaveBeenCalled();
  });
});
