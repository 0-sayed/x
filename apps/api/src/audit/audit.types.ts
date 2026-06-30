import type { AuditAudience } from '@materiabill/contracts';

type AuditEventMetadata = Record<string, unknown>;

export type InsertAuditEventInput = {
  readonly workspaceId: string;
  readonly actorUserId: string | null;
  readonly audience: AuditAudience;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly metadata: AuditEventMetadata;
  readonly occurredAt: Date;
};

export type ListAuditEventsInput = {
  readonly workspaceId: string;
  readonly audience?: AuditAudience;
  readonly before?: Date;
  readonly limit: number;
};
