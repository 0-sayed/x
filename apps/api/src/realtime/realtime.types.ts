import type {
  RealtimeEventEnvelope,
  RealtimeEventPayload,
  RealtimeEventType,
} from '@materiabill/contracts';
import type { MessageEvent } from '@nestjs/common';

export type PublishRealtimeEventInput = {
  readonly workspaceId: string;
  readonly type: RealtimeEventType;
  readonly payload?: RealtimeEventPayload;
  readonly id?: string;
  readonly occurredAt?: Date;
};

export type RealtimeSseMessage = MessageEvent & {
  readonly data: RealtimeEventEnvelope;
};
