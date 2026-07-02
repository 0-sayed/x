import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignOffsService } from './sign-offs.service.js';

const now = new Date('2026-07-01T10:00:00.000Z');
const signOff = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  subjectType: 'timeline_baseline',
  subjectId: 'baseline-1',
  title: 'Approve timeline baseline',
  summary: 'Client approval locks the initial baseline date.',
  assignedAudience: 'participants',
  requiredAction: 'approve',
  status: 'pending',
  requestedByUserId: '44444444-4444-4444-8444-444444444444',
  resolvedByUserId: null,
  resolutionReason: null,
  resolutionDecisionId: null,
  lastReminderAt: null,
  reminderCount: 0,
  createdAt: now,
  updatedAt: now,
  resolvedAt: null,
} as const;

type MockFn = ReturnType<typeof vi.fn>;

type RepositoryMock = {
  create: MockFn;
  list: MockFn;
  findByIdInWorkspace: MockFn;
  resolve: MockFn;
  markReminderSent: MockFn;
};

type GraceWindowServiceMock = {
  createPendingDecision: MockFn;
  hasActivePendingDecisionForRecord: MockFn;
};

type AuditServiceMock = {
  recordEvent: MockFn;
};

type CommitHandlerRegistryMock = {
  register: MockFn;
};

type ResolutionHandlerRegistryMock = {
  handle: MockFn;
};

describe('SignOffsService', () => {
  let repository: RepositoryMock;
  let graceWindowService: GraceWindowServiceMock;
  let auditService: AuditServiceMock;
  let commitHandlers: CommitHandlerRegistryMock;
  let resolutionHandlers: ResolutionHandlerRegistryMock;
  let service: SignOffsService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      list: vi.fn(),
      findByIdInWorkspace: vi.fn(),
      resolve: vi.fn(),
      markReminderSent: vi.fn(),
    };
    graceWindowService = {
      createPendingDecision: vi.fn(),
      hasActivePendingDecisionForRecord: vi.fn(),
    };
    auditService = { recordEvent: vi.fn() };
    commitHandlers = { register: vi.fn() };
    resolutionHandlers = { handle: vi.fn() };
    service = new SignOffsService(
      repository as unknown as ConstructorParameters<typeof SignOffsService>[0],
      graceWindowService as unknown as ConstructorParameters<typeof SignOffsService>[1],
      auditService as unknown as ConstructorParameters<typeof SignOffsService>[2],
      commitHandlers as unknown as ConstructorParameters<typeof SignOffsService>[3],
      resolutionHandlers as unknown as ConstructorParameters<typeof SignOffsService>[4],
    );
  });

  it('registers a grace-window commit handler for sign-off resolutions', async () => {
    service.onModuleInit();
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    repository.resolve.mockResolvedValueOnce({
      ...signOff,
      status: 'approved',
      resolvedByUserId: '55555555-5555-4555-8555-555555555555',
      resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      resolvedAt: now,
    });

    const handler = commitHandlers.register.mock.calls[0]?.[0];
    await handler.commit(
      {
        id: '66666666-6666-4666-8666-666666666666',
        workspaceId: signOff.workspaceId,
        projectId: signOff.projectId,
        requestedByUserId: '55555555-5555-4555-8555-555555555555',
        status: 'committed',
        audience: signOff.assignedAudience,
        decisionType: 'signoff.resolve',
        recordType: 'signoff',
        recordId: signOff.id,
        summaryLabel: 'Approve: Approve timeline baseline',
        commitPayload: {
          signOffId: signOff.id,
          actorUserId: '55555555-5555-4555-8555-555555555555',
          action: 'approve',
        },
        undoPayload: {},
        requestedAt: now,
        expiresAt: now,
        undoneAt: null,
        committedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      now,
    );

    expect(commitHandlers.register).toHaveBeenCalledWith(
      expect.objectContaining({ decisionType: 'signoff.resolve' }),
    );
    expect(repository.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        status: 'approved',
        resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      }),
    );
  });

  it('creates a pending sign-off and records audit', async () => {
    repository.create.mockResolvedValueOnce(signOff);

    const created = await service.createSignOff({
      workspaceId: signOff.workspaceId,
      projectId: signOff.projectId,
      subjectType: signOff.subjectType,
      subjectId: signOff.subjectId,
      title: signOff.title,
      summary: signOff.summary,
      assignedAudience: signOff.assignedAudience,
      requiredAction: signOff.requiredAction,
      requestedByUserId: signOff.requestedByUserId,
      now,
    });

    expect(created.id).toBe(signOff.id);
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: signOff.workspaceId,
        actorUserId: signOff.requestedByUserId,
        audience: 'client',
        action: 'signoff.created',
        resourceType: 'signoff',
        resourceId: signOff.id,
      }),
    );
  });

  it('rejects a missing reject reason before creating a pending decision', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);

    await expect(
      service.requestResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'reject',
        now,
      }),
    ).rejects.toThrow(ConflictException);

    expect(graceWindowService.createPendingDecision).not.toHaveBeenCalled();
  });

  it('blocks contractor-admin resolution for client-assigned sign-offs', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce({
      ...signOff,
      assignedAudience: 'client',
    });

    await expect(
      service.requestResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'approve',
        now,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates a grace-window pending decision for an internal/team response', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    graceWindowService.hasActivePendingDecisionForRecord.mockResolvedValueOnce(false);
    graceWindowService.createPendingDecision.mockResolvedValueOnce({
      id: '66666666-6666-4666-8666-666666666666',
      workspaceId: signOff.workspaceId,
      projectId: signOff.projectId,
      requestedByUserId: '55555555-5555-4555-8555-555555555555',
      status: 'pending',
      audience: signOff.assignedAudience,
      decisionType: 'signoff.resolve',
      recordType: 'signoff',
      recordId: signOff.id,
      summaryLabel: 'Approve: Approve timeline baseline',
      commitPayload: {},
      undoPayload: {},
      requestedAt: now.toISOString(),
      expiresAt: '2026-07-01T10:10:00.000Z',
      remainingSeconds: 600,
    });

    const response = await service.requestResolution({
      workspaceId: signOff.workspaceId,
      signOffId: signOff.id,
      actorUserId: '55555555-5555-4555-8555-555555555555',
      action: 'approve',
      now,
    });

    expect(response.signOff.status).toBe('pending');
    expect(response.pendingDecision.decisionType).toBe('signoff.resolve');
  });

  it('blocks a second in-flight resolution decision', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    graceWindowService.hasActivePendingDecisionForRecord.mockResolvedValueOnce(true);

    await expect(
      service.requestResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'approve',
        now,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('maps a duplicate pending decision race to conflict', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    graceWindowService.hasActivePendingDecisionForRecord.mockResolvedValueOnce(false);
    graceWindowService.createPendingDecision.mockRejectedValueOnce({
      constraint: 'pending_decisions_pending_record_unique_idx',
    });

    await expect(
      service.requestResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'approve',
        now,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('commits a pending decision resolution and records audit', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    repository.resolve.mockResolvedValueOnce({
      ...signOff,
      status: 'approved',
      resolvedByUserId: '55555555-5555-4555-8555-555555555555',
      resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      resolvedAt: now,
    });

    const resolved = await service.commitPendingDecisionResolution({
      workspaceId: signOff.workspaceId,
      signOffId: signOff.id,
      decisionId: '66666666-6666-4666-8666-666666666666',
      actorUserId: '55555555-5555-4555-8555-555555555555',
      action: 'approve',
      reason: undefined,
      now,
    });

    expect(resolved.status).toBe('approved');
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'signoff.resolved', resourceId: signOff.id }),
    );
  });

  it('notifies subject handlers after a sign-off resolution commits', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);
    repository.resolve.mockResolvedValueOnce({
      ...signOff,
      status: 'approved',
      resolvedByUserId: '55555555-5555-4555-8555-555555555555',
      resolutionDecisionId: '66666666-6666-4666-8666-666666666666',
      resolvedAt: now,
    });

    await service.commitPendingDecisionResolution({
      workspaceId: signOff.workspaceId,
      signOffId: signOff.id,
      decisionId: '66666666-6666-4666-8666-666666666666',
      actorUserId: '55555555-5555-4555-8555-555555555555',
      action: 'approve',
      now,
    });

    expect(resolutionHandlers.handle).toHaveBeenCalledWith(
      expect.objectContaining({ id: signOff.id, subjectType: 'timeline_baseline' }),
      expect.objectContaining({
        actorUserId: '55555555-5555-4555-8555-555555555555',
        decisionId: '66666666-6666-4666-8666-666666666666',
        resolvedAt: now,
      }),
    );
  });

  it('rejects commit-time rejection without a non-empty reason', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(signOff);

    await expect(
      service.commitPendingDecisionResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        decisionId: '66666666-6666-4666-8666-666666666666',
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'reject',
        reason: '   ',
        now,
      }),
    ).rejects.toThrow(ConflictException);

    expect(repository.resolve).not.toHaveBeenCalled();
  });

  it('rejects commit-time actions that no longer match the required action', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce({
      ...signOff,
      requiredAction: 'sign',
    });

    await expect(
      service.commitPendingDecisionResolution({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        decisionId: '66666666-6666-4666-8666-666666666666',
        actorUserId: '55555555-5555-4555-8555-555555555555',
        action: 'approve',
        now,
      }),
    ).rejects.toThrow(ConflictException);

    expect(repository.resolve).not.toHaveBeenCalled();
  });

  it('sends a manual reminder only for pending client-assigned sign-offs', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce({
      ...signOff,
      assignedAudience: 'client',
    });
    repository.markReminderSent.mockResolvedValueOnce({
      ...signOff,
      assignedAudience: 'client',
      lastReminderAt: now,
      reminderCount: 1,
    });

    const response = await service.sendManualReminder({
      workspaceId: signOff.workspaceId,
      signOffId: signOff.id,
      actorUserId: '55555555-5555-4555-8555-555555555555',
      now,
    });

    expect(response.signOff.reminderCount).toBe(1);
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'client', action: 'signoff.reminder_sent' }),
    );
  });

  it('returns not found for a missing workspace-scoped sign-off', async () => {
    repository.findByIdInWorkspace.mockResolvedValueOnce(undefined);

    await expect(
      service.sendManualReminder({
        workspaceId: signOff.workspaceId,
        signOffId: signOff.id,
        actorUserId: '55555555-5555-4555-8555-555555555555',
        now,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
