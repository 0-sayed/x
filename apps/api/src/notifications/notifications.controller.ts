import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  notificationListQuerySchema,
  replaceNotificationPreferencesRequestSchema,
  type WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { NotificationsService } from './notifications.service.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
@UseGuards(WorkspaceContextGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('notifications')
  listCurrentUserNotifications(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Query() query: unknown,
  ) {
    const context = requireWorkspaceContext(workspaceContext);
    const parsedQuery = notificationListQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException('Invalid notification query');
    }

    return this.notificationsService.listCurrentUserNotifications({
      workspaceId: context.workspace.id,
      recipientUserId: context.membership.userId,
      query,
    });
  }

  @Get('notifications/unread-count')
  getUnreadCount(@WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined) {
    const context = requireWorkspaceContext(workspaceContext);

    return this.notificationsService.getUnreadCount({
      workspaceId: context.workspace.id,
      recipientUserId: context.membership.userId,
    });
  }

  @Patch('notifications/:notificationId/read')
  markRead(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Param('notificationId') notificationId: string,
  ) {
    const context = requireWorkspaceContext(workspaceContext);
    if (!uuidPattern.test(notificationId)) {
      throw new BadRequestException('Invalid notification id');
    }

    return this.notificationsService.markRead({
      workspaceId: context.workspace.id,
      recipientUserId: context.membership.userId,
      notificationId,
    });
  }

  @Post('notifications/read-all')
  markAllRead(@WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined) {
    const context = requireWorkspaceContext(workspaceContext);

    return this.notificationsService.markAllRead({
      workspaceId: context.workspace.id,
      recipientUserId: context.membership.userId,
    });
  }

  @Get('notification-preferences')
  listPreferences(@WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined) {
    const context = requireWorkspaceContext(workspaceContext);
    assertCanReadPreferences(context);

    return this.notificationsService.listPreferences(context.workspace.id);
  }

  @Put('notification-preferences')
  replacePreferences(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Body() body: unknown,
  ) {
    const context = requireWorkspaceContext(workspaceContext);
    assertCanWritePreferences(context);

    if (!replaceNotificationPreferencesRequestSchema.safeParse(body).success) {
      throw new BadRequestException('Invalid notification preferences request');
    }

    return this.notificationsService.replacePreferences({
      workspaceId: context.workspace.id,
      body,
    });
  }
}

function requireWorkspaceContext(
  workspaceContext: WorkspaceContextValue | undefined,
): WorkspaceContextValue {
  if (!workspaceContext) {
    throw new UnauthorizedException('Not authenticated');
  }

  return workspaceContext;
}

function assertCanReadPreferences(workspaceContext: WorkspaceContextValue): void {
  if (
    workspaceContext.membership.isAdmin ||
    workspaceContext.membership.permissions.includes('settings.view') ||
    workspaceContext.membership.permissions.includes('settings.manage_defaults')
  ) {
    return;
  }

  throw new ForbiddenException('Permission denied');
}

function assertCanWritePreferences(workspaceContext: WorkspaceContextValue): void {
  if (
    workspaceContext.membership.isAdmin ||
    workspaceContext.membership.permissions.includes('settings.manage_defaults')
  ) {
    return;
  }

  throw new ForbiddenException('Permission denied');
}
