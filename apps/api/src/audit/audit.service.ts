import { Injectable } from '@nestjs/common';
import {
  auditEventListResponseSchema,
  auditEventQuerySchema,
  auditEventSchema,
  createAuditEventInputSchema,
  type AuditEvent,
  type AuditEventListResponse,
  type AuditEventQuery,
  type CreateAuditEventInput,
} from '@materiabill/contracts';
import type { AuditEventRecord } from '@materiabill/db';

import { AuditRepository } from './audit.repository.js';

export type RecordAuditEventInput = CreateAuditEventInput & {
  readonly occurredAt?: Date;
};

export type ListAuditEventsServiceInput = Omit<AuditEventQuery, 'limit'> & {
  readonly limit?: AuditEventQuery['limit'];
  readonly workspaceId: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async recordEvent(input: RecordAuditEventInput): Promise<AuditEvent> {
    const { occurredAt = new Date(), ...contractInput } = input;
    const parsedInput = createAuditEventInputSchema.parse(contractInput);

    const row = await this.repository.insertEvent({
      workspaceId: parsedInput.workspaceId,
      actorUserId: parsedInput.actorUserId,
      audience: parsedInput.audience,
      action: parsedInput.action,
      resourceType: parsedInput.resourceType,
      resourceId: parsedInput.resourceId ?? null,
      metadata: parsedInput.metadata ?? {},
      occurredAt,
    });

    return toAuditEvent(row);
  }

  async listEvents(input: ListAuditEventsServiceInput): Promise<AuditEventListResponse> {
    const parsedQuery = auditEventQuerySchema.parse({
      audience: input.audience,
      before: input.before,
      limit: input.limit,
    });

    const rows = await this.repository.listEvents({
      workspaceId: input.workspaceId,
      audience: parsedQuery.audience,
      before: parsedQuery.before ? new Date(parsedQuery.before) : undefined,
      limit: parsedQuery.limit,
    });

    return auditEventListResponseSchema.parse({
      events: rows.map(toAuditEvent),
    });
  }
}

function toAuditEvent(row: AuditEventRecord): AuditEvent {
  return auditEventSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    actorUserId: row.actorUserId,
    audience: row.audience,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: row.metadata,
    occurredAt: row.occurredAt.toISOString(),
  });
}
