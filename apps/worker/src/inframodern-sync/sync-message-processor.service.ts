import { Inject, Injectable } from '@nestjs/common';
import { syncEnvelopeSchema, type SyncEnvelope, type SyncResource } from '@materiabill/contracts';
import {
  syncCheckpoints,
  type SyncEnvelopePayload,
  syncFailures,
  syncInbox,
  type MateriabillDatabase,
} from '@materiabill/db';
import { eq } from 'drizzle-orm';

import { MATERIABILL_DB, ProjectionUpsertService } from './projection-upsert.service.js';
import type { InframodernSyncMessageProcessor } from './rabbitmq-client.service.js';
import { getPoisonSyncEventId, getSyncEventId } from './sync-event-id.js';

export type SyncProcessOutcome =
  | { readonly status: 'processed'; readonly eventId: string; readonly envelope: SyncEnvelope }
  | { readonly status: 'skipped'; readonly eventId: string; readonly envelope: SyncEnvelope }
  | { readonly status: 'failed'; readonly eventId: string };

const UNKNOWN_CORRELATION_ID = 'unknown';

@Injectable()
export class SyncMessageProcessorService implements InframodernSyncMessageProcessor {
  constructor(
    @Inject(MATERIABILL_DB) private readonly db: MateriabillDatabase,
    private readonly projections: ProjectionUpsertService,
  ) {}

  async processMessage(resource: SyncResource, rawMessage: string): Promise<SyncProcessOutcome> {
    const parsedEnvelope = this.parseEnvelope(rawMessage);

    if (!parsedEnvelope.ok) {
      return this.recordPoisonMessage(resource, rawMessage, parsedEnvelope.error);
    }

    const envelope = parsedEnvelope.envelope;
    const eventId = getSyncEventId(resource, envelope);

    const existing = await this.db.query.syncInbox.findFirst({
      where: eq(syncInbox.eventId, eventId),
    });

    if (existing?.processedAt) {
      return { status: 'skipped', eventId, envelope };
    }

    await this.db
      .insert(syncInbox)
      .values({
        eventId,
        resource,
        correlationId: envelope.correlationId,
        operationId: envelope.operationId,
        jobId: envelope.jobId,
        targetApp: envelope.targetApp,
        payload: envelope,
      })
      .onConflictDoNothing();

    try {
      await this.projections.upsert(resource, envelope.items);
      await this.markProcessed(resource, eventId);
      return { status: 'processed', eventId, envelope };
    } catch (error) {
      await this.recordFailure(resource, eventId, envelope, error);
      return { status: 'failed', eventId };
    }
  }

  private parseEnvelope(
    rawMessage: string,
  ):
    | { readonly ok: true; readonly envelope: SyncEnvelope }
    | { readonly ok: false; readonly error: Error } {
    try {
      return {
        ok: true,
        envelope: syncEnvelopeSchema.parse(JSON.parse(rawMessage)),
      };
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? `Invalid JSON: ${error.message}`
          : `Invalid envelope: ${String(error instanceof Error ? error.message : error)}`;
      return {
        ok: false,
        error: error instanceof Error ? new Error(message, { cause: error }) : new Error(message),
      };
    }
  }

  private async recordPoisonMessage(
    resource: SyncResource,
    rawMessage: string,
    error: Error,
  ): Promise<SyncProcessOutcome> {
    const eventId = getPoisonSyncEventId(resource, rawMessage);
    const payload = this.buildPoisonPayload(rawMessage);

    await this.db
      .insert(syncInbox)
      .values({
        eventId,
        resource,
        correlationId: UNKNOWN_CORRELATION_ID,
        payload,
      })
      .onConflictDoNothing();

    await this.recordFailure(resource, eventId, payload, error);

    return { status: 'failed', eventId };
  }

  private async markProcessed(resource: SyncResource, eventId: string): Promise<void> {
    const now = new Date();

    await this.db.update(syncInbox).set({ processedAt: now }).where(eq(syncInbox.eventId, eventId));

    await this.db
      .insert(syncCheckpoints)
      .values({
        resource,
        lastEventId: eventId,
        lastSyncedAt: now,
      })
      .onConflictDoUpdate({
        target: syncCheckpoints.resource,
        set: {
          lastEventId: eventId,
          lastSyncedAt: now,
          updatedAt: now,
        },
      });

    await this.db
      .update(syncFailures)
      .set({ resolvedAt: now })
      .where(eq(syncFailures.eventId, eventId));
  }

  private async recordFailure(
    resource: SyncResource,
    eventId: string,
    payload: SyncEnvelope | SyncEnvelopePayload,
    error: unknown,
  ): Promise<void> {
    const failure = error instanceof Error ? error : new Error(String(error));

    await this.db
      .insert(syncFailures)
      .values({
        eventId,
        resource,
        correlationId: payload.correlationId,
        operationId: payload.operationId,
        jobId: payload.jobId,
        payload,
        errorMessage: failure.message,
        errorStack: failure.stack,
      })
      .onConflictDoUpdate({
        target: syncFailures.eventId,
        set: {
          errorMessage: failure.message,
          errorStack: failure.stack,
          failedAt: new Date(),
          resolvedAt: null,
        },
      });
  }

  private buildPoisonPayload(rawMessage: string): SyncEnvelopePayload {
    return {
      correlationId: UNKNOWN_CORRELATION_ID,
      items: [{ rawMessage }],
    };
  }
}
