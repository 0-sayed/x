import { randomUUID } from 'node:crypto';

import { realtimeEventEnvelopeSchema, type RealtimeEventEnvelope } from '@materiabill/contracts';
import { Injectable } from '@nestjs/common';
import { interval, merge, Observable, of, Subject } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import type { PublishRealtimeEventInput, RealtimeSseMessage } from './realtime.types.js';

const SSE_RETRY_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 25_000;

@Injectable()
export class RealtimeHub {
  readonly #channels = new Map<string, Subject<RealtimeSseMessage>>();
  readonly #subscriberCounts = new Map<string, number>();

  subscribe(workspaceId: string): Observable<RealtimeSseMessage> {
    const channel = this.#getChannel(workspaceId);
    this.#subscriberCounts.set(workspaceId, this.getSubscriberCount(workspaceId) + 1);

    const connected = of(
      toSseMessage(
        this.#buildEnvelope({
          workspaceId,
          type: 'realtime.connected',
          payload: {},
        }),
      ),
    );
    const heartbeat = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(() =>
        toSseMessage(
          this.#buildEnvelope({
            workspaceId,
            type: 'realtime.heartbeat',
            payload: {},
          }),
        ),
      ),
    );

    return merge(connected, channel.asObservable(), heartbeat).pipe(
      finalize(() => {
        const nextCount = Math.max(0, this.getSubscriberCount(workspaceId) - 1);
        if (nextCount === 0) {
          this.#subscriberCounts.delete(workspaceId);
          return;
        }

        this.#subscriberCounts.set(workspaceId, nextCount);
      }),
    );
  }

  publish(input: PublishRealtimeEventInput): RealtimeEventEnvelope {
    const envelope = this.#buildEnvelope(input);
    this.#channels.get(envelope.workspaceId)?.next(toSseMessage(envelope));

    return envelope;
  }

  getSubscriberCount(workspaceId: string): number {
    return this.#subscriberCounts.get(workspaceId) ?? 0;
  }

  #getChannel(workspaceId: string): Subject<RealtimeSseMessage> {
    const existing = this.#channels.get(workspaceId);
    if (existing) {
      return existing;
    }

    const created = new Subject<RealtimeSseMessage>();
    this.#channels.set(workspaceId, created);

    return created;
  }

  #buildEnvelope(input: PublishRealtimeEventInput): RealtimeEventEnvelope {
    return realtimeEventEnvelopeSchema.parse({
      id: input.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      type: input.type,
      payload: input.payload ?? {},
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    });
  }
}

function toSseMessage(envelope: RealtimeEventEnvelope): RealtimeSseMessage {
  return {
    id: envelope.id,
    type: envelope.type,
    retry: SSE_RETRY_MS,
    data: envelope,
  };
}
