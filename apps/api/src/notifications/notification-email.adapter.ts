import type { NotificationDeliveryStatus, NotificationEventType } from '@materiabill/contracts';
import { Injectable } from '@nestjs/common';

export const NOTIFICATION_EMAIL_ADAPTER = Symbol('NOTIFICATION_EMAIL_ADAPTER');

export type NotificationEmailInput = {
  readonly workspaceId: string;
  readonly eventType: NotificationEventType;
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly payload: Record<string, unknown>;
};

export type NotificationEmailResult = {
  readonly status: Extract<NotificationDeliveryStatus, 'sent' | 'skipped' | 'failed'>;
  readonly providerMessageId: string | null;
  readonly skippedReason: string | null;
  readonly errorMessage: string | null;
};

export interface NotificationEmailAdapter {
  send(input: NotificationEmailInput): Promise<NotificationEmailResult>;
}

@Injectable()
export class UnconfiguredNotificationEmailAdapter implements NotificationEmailAdapter {
  send(input: NotificationEmailInput): Promise<NotificationEmailResult> {
    void input;

    return Promise.resolve({
      status: 'skipped',
      providerMessageId: null,
      skippedReason: 'email.provider_unconfigured',
      errorMessage: null,
    });
  }
}
