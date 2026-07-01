import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import {
  createSignOffInputSchema,
  signOffListQuerySchema,
  signOffListResponseSchema,
  signOffReminderResponseSchema,
  signOffSchema,
  resolveSignOffResponseSchema,
  type AuditAudience,
  type PendingDecision,
  type SignOff,
  type SignOffAssignedAudience,
  type SignOffListResponse,
  type SignOffResolutionAction,
  type SignOffStatus,
  signOffResolutionActionSchema,
} from '@materiabill/contracts';
import type { PendingDecisionRecord, SignOffRecord } from '@materiabill/db';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import { GraceWindowCommitHandlerRegistry } from '../grace-window/grace-window-commit-handlers.js';
import { GraceWindowService } from '../grace-window/grace-window.service.js';
import { SignOffsRepository } from './sign-offs.repository.js';
import type {
  CommitSignOffResolutionInput,
  CreateSignOffInput,
  ResolveSignOffInput,
  SendSignOffReminderInput,
} from './sign-offs.types.js';

type ListSignOffsInput = {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly status?: SignOffStatus;
  readonly assignedAudience?: SignOffAssignedAudience;
  readonly limit?: number;
};

@Injectable()
export class SignOffsService implements OnModuleInit {
  constructor(
    private readonly repository: SignOffsRepository,
    private readonly graceWindowService: GraceWindowService,
    private readonly auditService: AuditService,
    @Optional() private readonly commitHandlers?: GraceWindowCommitHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.commitHandlers?.register({
      decisionType: 'signoff.resolve',
      commit: async (decision, now) => {
        await this.commitPendingDecisionResolution(toCommitSignOffResolutionInput(decision, now));
      },
    });
  }

  async createSignOff(input: CreateSignOffInput): Promise<SignOff> {
    const { now = new Date(), ...contractInput } = input;
    const parsed = createSignOffInputSchema.parse(contractInput);
    const created = await this.repository.create({
      ...parsed,
      id: randomUUID(),
      summary: parsed.summary ?? null,
      status: 'pending',
      resolvedByUserId: null,
      resolutionReason: null,
      resolutionDecisionId: null,
      lastReminderAt: null,
      reminderCount: 0,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    });

    await this.auditService.recordEvent({
      workspaceId: created.workspaceId,
      actorUserId: created.requestedByUserId,
      audience: toAuditAudience(created.assignedAudience),
      action: 'signoff.created',
      resourceType: 'signoff',
      resourceId: created.id,
      metadata: {
        projectId: created.projectId,
        subjectType: created.subjectType,
        subjectId: created.subjectId,
        requiredAction: created.requiredAction,
      },
      occurredAt: now,
    });

    return toSignOff(created);
  }

  async listSignOffs(input: ListSignOffsInput): Promise<SignOffListResponse> {
    const parsedQuery = signOffListQuerySchema.parse({
      projectId: input.projectId,
      status: input.status,
      assignedAudience: input.assignedAudience,
      limit: input.limit,
    });

    const rows = await this.repository.list({
      workspaceId: input.workspaceId,
      projectId: parsedQuery.projectId,
      status: parsedQuery.status,
      assignedAudience: parsedQuery.assignedAudience,
      limit: parsedQuery.limit,
    });

    return signOffListResponseSchema.parse({
      signOffs: rows.map(toSignOff),
    });
  }

  async requestResolution(input: ResolveSignOffInput): Promise<{
    signOff: SignOff;
    pendingDecision: PendingDecision;
  }> {
    const now = input.now ?? new Date();
    const signOff = await this.repository.findByIdInWorkspace({
      workspaceId: input.workspaceId,
      signOffId: input.signOffId,
    });

    if (!signOff) {
      throw new NotFoundException('Sign-off not found');
    }

    if (signOff.status !== 'pending') {
      throw new ConflictException('Sign-off is no longer pending');
    }

    if (signOff.assignedAudience === 'client') {
      throw new ForbiddenException('Client-assigned sign-offs cannot be resolved here');
    }

    const reason = input.reason?.trim();
    if (input.action === 'reject' && !reason) {
      throw new ConflictException('Rejecting a sign-off requires a reason');
    }

    if (
      (input.action === 'approve' || input.action === 'sign') &&
      input.action !== signOff.requiredAction
    ) {
      throw new ConflictException('Resolution action does not match required action');
    }

    const hasPending = await this.graceWindowService.hasActivePendingDecisionForRecord({
      workspaceId: signOff.workspaceId,
      decisionType: 'signoff.resolve',
      recordType: 'signoff',
      recordId: signOff.id,
      now,
    });

    if (hasPending) {
      throw new ConflictException('A pending resolution decision already exists');
    }

    let pendingDecision: PendingDecision;
    try {
      pendingDecision = await this.graceWindowService.createPendingDecision({
        workspaceId: signOff.workspaceId,
        projectId: signOff.projectId,
        actorUserId: input.actorUserId,
        audience: signOff.assignedAudience,
        decisionType: 'signoff.resolve',
        recordType: 'signoff',
        recordId: signOff.id,
        summaryLabel: `${capitalize(input.action)}: ${signOff.title}`,
        commitPayload: {
          signOffId: signOff.id,
          action: input.action,
          actorUserId: input.actorUserId,
          reason,
          requestedAt: now.toISOString(),
        },
        undoPayload: {},
        requestedAt: now.toISOString(),
        graceWindowMinutes: 10,
      });
    } catch (error) {
      if (isPendingRecordUniqueViolation(error)) {
        throw new ConflictException('A pending resolution decision already exists');
      }
      throw error;
    }

    return resolveSignOffResponseSchema.parse({
      signOff: toSignOff(signOff),
      pendingDecision,
    });
  }

  async commitPendingDecisionResolution(input: CommitSignOffResolutionInput): Promise<SignOff> {
    const now = input.now ?? new Date();
    const signOff = await this.repository.findByIdInWorkspace({
      workspaceId: input.workspaceId,
      signOffId: input.signOffId,
    });

    if (!signOff) {
      throw new NotFoundException('Sign-off not found');
    }

    if (signOff.status !== 'pending') {
      throw new ConflictException('Sign-off is no longer pending');
    }

    const reason = normalizeOptionalReason(input.reason);
    if (input.action === 'reject' && !reason) {
      throw new ConflictException('Rejecting a sign-off requires a reason');
    }

    if (
      (input.action === 'approve' || input.action === 'sign') &&
      input.action !== signOff.requiredAction
    ) {
      throw new ConflictException('Resolution action does not match required action');
    }

    const resolved = await this.repository.resolve({
      workspaceId: input.workspaceId,
      signOffId: input.signOffId,
      status: statusForAction(input.action),
      resolvedByUserId: input.actorUserId,
      resolutionReason: reason,
      resolutionDecisionId: input.decisionId,
      now,
    });

    if (!resolved) {
      throw new ConflictException('Sign-off is no longer pending');
    }

    await this.auditService.recordEvent({
      workspaceId: resolved.workspaceId,
      actorUserId: input.actorUserId,
      audience: toAuditAudience(resolved.assignedAudience),
      action: 'signoff.resolved',
      resourceType: 'signoff',
      resourceId: resolved.id,
      metadata: {
        decisionId: input.decisionId,
        status: resolved.status,
        reason: resolved.resolutionReason,
      },
      occurredAt: now,
    });

    return toSignOff(resolved);
  }

  async sendManualReminder(input: SendSignOffReminderInput): Promise<{ signOff: SignOff }> {
    const now = input.now ?? new Date();
    const signOff = await this.repository.findByIdInWorkspace({
      workspaceId: input.workspaceId,
      signOffId: input.signOffId,
    });

    if (!signOff) {
      throw new NotFoundException('Sign-off not found');
    }

    if (signOff.status !== 'pending') {
      throw new ConflictException('Sign-off is no longer pending');
    }

    if (signOff.assignedAudience !== 'client') {
      throw new ConflictException('Only pending client sign-offs can be reminded');
    }

    const reminded = await this.repository.markReminderSent({
      workspaceId: input.workspaceId,
      signOffId: input.signOffId,
      now,
    });

    if (!reminded) {
      throw new ConflictException('Only pending client sign-offs can be reminded');
    }

    await this.auditService.recordEvent({
      workspaceId: reminded.workspaceId,
      actorUserId: input.actorUserId,
      audience: 'client',
      action: 'signoff.reminder_sent',
      resourceType: 'signoff',
      resourceId: reminded.id,
      metadata: {
        reminderCount: reminded.reminderCount,
      },
      occurredAt: now,
    });

    return signOffReminderResponseSchema.parse({
      signOff: toSignOff(reminded),
    });
  }
}

function toAuditAudience(audience: SignOffAssignedAudience): AuditAudience {
  return audience === 'org' ? 'internal' : 'client';
}

function statusForAction(action: SignOffResolutionAction): SignOffStatus {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  return 'signed';
}

function toSignOff(row: SignOffRecord): SignOff {
  return signOffSchema.parse({
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    title: row.title,
    summary: row.summary,
    assignedAudience: row.assignedAudience,
    requiredAction: row.requiredAction,
    status: row.status,
    requestedByUserId: row.requestedByUserId,
    resolvedByUserId: row.resolvedByUserId,
    resolutionReason: row.resolutionReason,
    resolutionDecisionId: row.resolutionDecisionId,
    lastReminderAt: row.lastReminderAt?.toISOString() ?? null,
    reminderCount: row.reminderCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeOptionalReason(reason: string | undefined): string | null {
  const trimmed = reason?.trim() ?? '';
  if (trimmed.length === 0) return null;
  return trimmed;
}

function toCommitSignOffResolutionInput(
  decision: PendingDecisionRecord,
  now: Date,
): CommitSignOffResolutionInput {
  const payload = decision.commitPayload;
  if (!isCommitPayload(payload)) {
    throw new ConflictException('Invalid sign-off resolution payload');
  }

  const parsedAction = signOffResolutionActionSchema.safeParse(payload.action);
  if (!parsedAction.success) {
    throw new ConflictException('Invalid sign-off resolution payload');
  }

  return {
    workspaceId: decision.workspaceId,
    signOffId: payload.signOffId,
    decisionId: decision.id,
    actorUserId: payload.actorUserId,
    action: parsedAction.data,
    reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    now,
  };
}

function isCommitPayload(payload: unknown): payload is {
  readonly signOffId: string;
  readonly actorUserId: string;
  readonly action: unknown;
  readonly reason?: unknown;
} {
  return (
    isRecord(payload) &&
    typeof payload.signOffId === 'string' &&
    typeof payload.actorUserId === 'string' &&
    'action' in payload
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPendingRecordUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    error.constraint === 'pending_decisions_pending_record_unique_idx'
  );
}
