import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPendingDecisionInputSchema,
  pendingDecisionListResponseSchema,
  pendingDecisionSchema,
  undoPendingDecisionResponseSchema,
  type AuditAudience,
  type CreatePendingDecisionInput,
  type DecisionAudience,
  type PendingDecision,
  type PendingDecisionListResponse,
  type WorkspaceContext,
  type UndoPendingDecisionResponse,
} from '@materiabill/contracts';
import type { PendingDecisionRecord } from '@materiabill/db';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import { GraceWindowRepository } from './grace-window.repository.js';

type ListActivePendingDecisionsInput = {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly now?: Date;
  readonly limit?: number;
};

type UndoPendingDecisionInput = {
  readonly workspaceContext: WorkspaceContext;
  readonly decisionId: string;
  readonly now?: Date;
};

type MarkExpiredDecisionCommittedInput = {
  readonly workspaceId: string;
  readonly decisionId: string;
  readonly now?: Date;
};

@Injectable()
export class GraceWindowService {
  constructor(
    private readonly repository: GraceWindowRepository,
    private readonly auditService: AuditService,
  ) {}

  async createPendingDecision(input: CreatePendingDecisionInput): Promise<PendingDecision> {
    const parsed = createPendingDecisionInputSchema.parse(input);
    const requestedAt = parsed.requestedAt ? new Date(parsed.requestedAt) : new Date();
    const expiresAt = new Date(requestedAt.getTime() + parsed.graceWindowMinutes * 60_000);

    const created = await this.repository.createDecision({
      id: randomUUID(),
      workspaceId: parsed.workspaceId,
      projectId: parsed.projectId ?? null,
      requestedByUserId: parsed.actorUserId,
      status: 'pending',
      audience: parsed.audience,
      decisionType: parsed.decisionType,
      recordType: parsed.recordType,
      recordId: parsed.recordId ?? null,
      summaryLabel: parsed.summaryLabel,
      commitPayload: parsed.commitPayload ?? {},
      undoPayload: parsed.undoPayload ?? {},
      requestedAt,
      expiresAt,
    });

    await this.auditService.recordEvent({
      workspaceId: created.workspaceId,
      actorUserId: created.requestedByUserId,
      audience: toAuditAudience(created.audience),
      action: 'grace_window.created',
      resourceType: 'pending_decision',
      resourceId: created.id,
      metadata: {
        decisionType: created.decisionType,
        recordType: created.recordType,
        recordId: created.recordId,
        expiresAt: created.expiresAt.toISOString(),
      },
    });

    return toPendingDecision(created, requestedAt);
  }

  async listActivePendingDecisions(
    input: ListActivePendingDecisionsInput,
  ): Promise<PendingDecisionListResponse> {
    const now = input.now ?? new Date();
    const rows = await this.repository.listActive({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      now,
      limit: input.limit ?? 50,
    });

    return pendingDecisionListResponseSchema.parse({
      decisions: rows.map((row) => toPendingDecision(row, now)),
    });
  }

  async undoPendingDecision(input: UndoPendingDecisionInput): Promise<UndoPendingDecisionResponse> {
    const now = input.now ?? new Date();
    const workspaceId = input.workspaceContext.workspace.id;
    const existing = await this.repository.findByIdInWorkspace({
      workspaceId,
      decisionId: input.decisionId,
    });

    if (!existing) {
      throw new NotFoundException('Pending decision not found');
    }

    if (existing.status !== 'pending' || existing.expiresAt <= now) {
      throw new ConflictException('Pending decision is no longer undoable');
    }

    const requesterId = existing.requestedByUserId;
    const actorId = input.workspaceContext.membership.userId;
    const isAdmin = input.workspaceContext.membership.isAdmin;
    if (requesterId !== actorId && !isAdmin) {
      throw new ForbiddenException(
        'Only the requester or a workspace admin can undo this decision',
      );
    }

    const undone = await this.repository.undoPending({
      workspaceId,
      decisionId: input.decisionId,
      now,
    });

    if (!undone) {
      throw new ConflictException('Pending decision is no longer undoable');
    }

    await this.auditService.recordEvent({
      workspaceId: undone.workspaceId,
      actorUserId: actorId,
      audience: toAuditAudience(undone.audience),
      action: 'grace_window.undone',
      resourceType: 'pending_decision',
      resourceId: undone.id,
      metadata: {
        decisionType: undone.decisionType,
        recordType: undone.recordType,
        recordId: undone.recordId,
      },
    });

    return undoPendingDecisionResponseSchema.parse({
      decision: toPendingDecision(undone, now),
    });
  }

  async markExpiredDecisionCommitted(
    input: MarkExpiredDecisionCommittedInput,
  ): Promise<PendingDecision> {
    const now = input.now ?? new Date();
    const committed = await this.repository.commitExpired({
      workspaceId: input.workspaceId,
      decisionId: input.decisionId,
      now,
    });

    if (!committed) {
      throw new ConflictException('Pending decision is not ready to commit');
    }

    await this.auditService.recordEvent({
      workspaceId: committed.workspaceId,
      actorUserId: committed.requestedByUserId,
      audience: toAuditAudience(committed.audience),
      action: 'grace_window.committed',
      resourceType: 'pending_decision',
      resourceId: committed.id,
      metadata: {
        decisionType: committed.decisionType,
        recordType: committed.recordType,
        recordId: committed.recordId,
      },
    });

    return toPendingDecision(committed, now);
  }
}

function toPendingDecision(row: PendingDecisionRecord, now: Date): PendingDecision {
  return pendingDecisionSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    requestedByUserId: row.requestedByUserId,
    status: row.status,
    audience: row.audience,
    decisionType: row.decisionType,
    recordType: row.recordType,
    recordId: row.recordId,
    summaryLabel: row.summaryLabel,
    commitPayload: row.commitPayload,
    undoPayload: row.undoPayload,
    requestedAt: row.requestedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    remainingSeconds: remainingSeconds(row.expiresAt, now),
  });
}

function remainingSeconds(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}

function toAuditAudience(audience: DecisionAudience): AuditAudience {
  return audience === 'org' ? 'internal' : 'client';
}
