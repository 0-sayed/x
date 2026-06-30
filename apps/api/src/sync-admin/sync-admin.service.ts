import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { getSyncAdminRuntimeConfig } from '@materiabill/config';
import {
  syncEnvelopeSchema,
  syncResourceSchema,
  type SyncEnvelope,
  type SyncFailureListItem,
  type SyncPullRequest,
  type SyncPullResponse,
  type SyncResource,
  type SyncRetryResponse,
} from '@materiabill/contracts';
import { syncFailures, type MateriabillDatabase } from '@materiabill/db';
import { and, eq, isNull } from 'drizzle-orm';

import { InframodernPullSource } from './inframodern-pull-source.js';
import { SyncAdminRabbitMqService } from './sync-admin-rabbitmq.service.js';

export const SYNC_ADMIN_DB = Symbol('SYNC_ADMIN_DB');

const defaultPullResources = [
  'users',
  'brands',
  'locations',
  'exchange-rates',
] as const satisfies readonly SyncResource[];

export type SyncAdminDatabase = {
  readonly query: MateriabillDatabase['query'];
  incrementFailureRetryCount(failureId: string): Promise<void>;
};

@Injectable()
export class SyncAdminService {
  constructor(
    @Inject(SYNC_ADMIN_DB) private readonly db: SyncAdminDatabase,
    @Inject(SyncAdminRabbitMqService) private readonly rabbit: SyncAdminRabbitMqService,
    @Inject(InframodernPullSource) private readonly pullSource: InframodernPullSource,
  ) {}

  async listFailures(): Promise<SyncFailureListItem[]> {
    const failures = await this.db.query.syncFailures.findMany({
      where: isNull(syncFailures.resolvedAt),
    });

    return failures.map((failure) => ({
      id: failure.id,
      eventId: failure.eventId,
      resource: mapFailureResource(failure.resource),
      correlationId: failure.correlationId,
      operationId: failure.operationId,
      jobId: failure.jobId,
      retryCount: failure.retryCount,
      errorMessage: failure.errorMessage,
      failedAt: failure.failedAt.toISOString(),
    }));
  }

  async retryFailure(failureId: string): Promise<SyncRetryResponse> {
    const failure = await this.db.query.syncFailures.findFirst({
      where: and(eq(syncFailures.id, failureId), isNull(syncFailures.resolvedAt)),
    });

    if (!failure) {
      throw new NotFoundException('Sync failure is not retryable');
    }

    const resource = syncResourceSchema.safeParse(failure.resource);

    if (!resource.success) {
      throw new NotFoundException('Sync failure is not retryable');
    }

    const envelope: SyncEnvelope = syncEnvelopeSchema.parse(failure.payload);

    await this.rabbit.publishEnvelope(resource.data, envelope);
    await this.db.incrementFailureRetryCount(failureId);

    return { status: 'queued', failureId };
  }

  async pull(request: SyncPullRequest): Promise<SyncPullResponse> {
    const { inframodernDbUrl } = getSyncAdminRuntimeConfig(process.env);

    if (!inframodernDbUrl) {
      throw new ServiceUnavailableException('INFRAMODERN_DB_URL is required');
    }

    const resources = [...new Set(request.resources ?? defaultPullResources)];
    const batches = await this.pullSource.readBatches(inframodernDbUrl, resources);

    for (const batch of batches) {
      await this.rabbit.publishEnvelope(batch.resource, batch.envelope);
    }

    return { status: 'queued', resources, publishedMessages: batches.length };
  }
}

function mapFailureResource(resource: string): SyncFailureListItem['resource'] {
  const parsed = syncResourceSchema.safeParse(resource);
  return parsed.success ? parsed.data : 'unknown';
}
