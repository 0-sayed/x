import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import {
  NOTIFICATION_EMAIL_ADAPTER,
  UnconfiguredNotificationEmailAdapter,
} from './notification-email.adapter.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import type { NotificationEmailAdapter } from './notification-email.adapter.js';

@Module({
  imports: [AuditModule, RealtimeModule, SessionModule, WorkspaceContextModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    UnconfiguredNotificationEmailAdapter,
    {
      provide: NOTIFICATION_EMAIL_ADAPTER,
      useExisting: UnconfiguredNotificationEmailAdapter,
    },
    {
      provide: NotificationsService,
      useFactory: (
        repository: NotificationsRepository,
        emailAdapter: NotificationEmailAdapter,
        realtimePublisher: RealtimePublisher,
        auditService: AuditService,
      ) => new NotificationsService(repository, emailAdapter, realtimePublisher, auditService),
      inject: [
        NotificationsRepository,
        NOTIFICATION_EMAIL_ADAPTER,
        RealtimePublisher,
        AuditService,
      ],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
