import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { WorkspaceContext } from '@materiabill/contracts';
import type { PendingDecisionRecord } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { GraceWindowService } from './grace-window.service.js';

const requesterUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

const row: PendingDecisionRecord = {
  id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
  workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  projectId: null,
  requestedByUserId: requesterUserId,
  status: 'pending',
  audience: 'participants',
  decisionType: 'signoff.approve',
  recordType: 'signoff',
  recordId: 'b78a2186-932e-43bb-a4c5-3853d4f9a0ff',
  summaryLabel: 'Approve timeline baseline',
  commitPayload: {},
  undoPayload: {},
  requestedAt: new Date('2026-07-01T09:00:00.000Z'),
  expiresAt: new Date('2026-07-01T09:10:00.000Z'),
  undoneAt: null,
  committedAt: null,
  createdAt: new Date('2026-07-01T09:00:00.000Z'),
  updatedAt: new Date('2026-07-01T09:00:00.000Z'),
};

const workspaceContext: WorkspaceContext = {
  workspace: {
    id: row.workspaceId,
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: requesterUserId,
    roleKey: 'workspace_admin',
    permissions: ['workspace.view'],
    isAdmin: false,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

type ServiceOverrides = {
  readonly find?: PendingDecisionRecord | undefined;
  readonly undo?: PendingDecisionRecord | undefined;
  readonly commit?: PendingDecisionRecord | undefined;
};

function createService(overrides: ServiceOverrides = {}) {
  const repository = {
    createDecision: vi.fn().mockImplementation(async (input) => ({
      ...row,
      ...input,
      id: row.id,
      requestedAt: input.requestedAt,
      expiresAt: input.expiresAt,
    })),
    listActive: vi.fn().mockResolvedValue([row]),
    findByIdInWorkspace: vi.fn().mockResolvedValue('find' in overrides ? overrides.find : row),
    undoPending: vi.fn().mockResolvedValue(
      overrides.undo ?? {
        ...row,
        status: 'undone',
        undoneAt: new Date('2026-07-01T09:05:00.000Z'),
        updatedAt: new Date('2026-07-01T09:05:00.000Z'),
      },
    ),
    commitExpired: vi.fn().mockResolvedValue(
      overrides.commit ?? {
        ...row,
        status: 'committed',
        committedAt: new Date('2026-07-01T09:12:00.000Z'),
        updatedAt: new Date('2026-07-01T09:12:00.000Z'),
      },
    ),
  };
  const auditService = {
    recordEvent: vi.fn().mockResolvedValue(undefined),
  };
  const settingsService = {
    getGraceWindowMinutes: vi.fn().mockResolvedValue(12),
  };

  return {
    auditService,
    repository,
    service: new GraceWindowService(
      repository as never,
      auditService as never,
      settingsService as never,
    ),
    settingsService,
  };
}

describe('GraceWindowService', () => {
  it('uses the workspace settings grace window when no explicit minutes are provided', async () => {
    const { repository, service, settingsService } = createService();
    repository.createDecision.mockResolvedValueOnce({
      ...row,
      audience: 'org',
      decisionType: 'draw.release',
      recordType: 'draw',
      recordId: null,
      summaryLabel: 'Release draw D-104',
      requestedAt: new Date('2026-07-01T09:00:00.000Z'),
      expiresAt: new Date('2026-07-01T09:12:00.000Z'),
    });

    await expect(
      service.createPendingDecision({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        actorUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        audience: 'org',
        decisionType: 'draw.release',
        recordType: 'draw',
        summaryLabel: 'Release draw D-104',
        requestedAt: '2026-07-01T09:00:00.000Z',
      }),
    ).resolves.toMatchObject({
      expiresAt: '2026-07-01T09:12:00.000Z',
    });

    expect(settingsService.getGraceWindowMinutes).toHaveBeenCalledWith(row.workspaceId);
    expect(repository.createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date('2026-07-01T09:12:00.000Z'),
      }),
    );
  });

  it('keeps explicit grace window minutes ahead of workspace settings', async () => {
    const { repository, service, settingsService } = createService();

    await service.createPendingDecision({
      workspaceId: row.workspaceId,
      actorUserId: row.requestedByUserId,
      audience: 'participants',
      decisionType: row.decisionType,
      recordType: row.recordType,
      recordId: row.recordId,
      summaryLabel: row.summaryLabel,
      requestedAt: '2026-07-01T09:00:00.000Z',
      graceWindowMinutes: 3,
    });

    expect(settingsService.getGraceWindowMinutes).not.toHaveBeenCalled();
    expect(repository.createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date('2026-07-01T09:03:00.000Z'),
      }),
    );
  });

  it('creates a pending decision and records an audit event', async () => {
    const { auditService, repository, service } = createService();

    await expect(
      service.createPendingDecision({
        workspaceId: row.workspaceId,
        actorUserId: row.requestedByUserId,
        audience: 'participants',
        decisionType: row.decisionType,
        recordType: row.recordType,
        recordId: row.recordId,
        summaryLabel: row.summaryLabel,
        requestedAt: '2026-07-01T09:00:00.000Z',
        graceWindowMinutes: 10,
      }),
    ).resolves.toMatchObject({
      id: row.id,
      status: 'pending',
      remainingSeconds: 600,
    });

    expect(repository.createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        requestedAt: new Date('2026-07-01T09:00:00.000Z'),
        expiresAt: new Date('2026-07-01T09:10:00.000Z'),
      }),
    );
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'client',
        action: 'grace_window.created',
        resourceType: 'pending_decision',
        resourceId: row.id,
      }),
    );
  });

  it('maps org audience to internal audit events', async () => {
    const { auditService, repository, service } = createService();
    repository.createDecision.mockResolvedValueOnce({
      ...row,
      audience: 'org',
    });

    await service.createPendingDecision({
      workspaceId: row.workspaceId,
      actorUserId: row.requestedByUserId,
      audience: 'org',
      decisionType: row.decisionType,
      recordType: row.recordType,
      recordId: row.recordId,
      summaryLabel: row.summaryLabel,
      requestedAt: '2026-07-01T09:00:00.000Z',
    });

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
      }),
    );
  });

  it('lists active decisions with countdown seconds from the provided clock', async () => {
    const { repository, service } = createService();

    await expect(
      service.listActivePendingDecisions({
        workspaceId: row.workspaceId,
        now: new Date('2026-07-01T09:05:30.000Z'),
      }),
    ).resolves.toEqual({
      decisions: [
        expect.objectContaining({
          id: row.id,
          remainingSeconds: 270,
        }),
      ],
    });

    expect(repository.listActive).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      projectId: undefined,
      now: new Date('2026-07-01T09:05:30.000Z'),
      limit: 50,
    });
  });

  it('allows the original requester to undo an active pending decision', async () => {
    const { auditService, repository, service } = createService();

    await expect(
      service.undoPendingDecision({
        workspaceContext,
        decisionId: row.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).resolves.toMatchObject({
      decision: {
        id: row.id,
        status: 'undone',
      },
    });

    expect(repository.undoPending).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      decisionId: row.id,
      now: new Date('2026-07-01T09:05:00.000Z'),
    });
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'client',
        action: 'grace_window.undone',
      }),
    );
  });

  it('allows a workspace admin to undo another users active pending decision', async () => {
    const { service } = createService({
      find: {
        ...row,
        requestedByUserId: '129edcb2-eabf-4361-84c6-bb2441ec92a2',
      },
    });

    await expect(
      service.undoPendingDecision({
        workspaceContext: {
          ...workspaceContext,
          membership: {
            ...workspaceContext.membership,
            userId: '81ace51a-9c22-43ae-a5d5-f2ba057fb36c',
            isAdmin: true,
          },
        },
        decisionId: row.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).resolves.toMatchObject({
      decision: {
        id: row.id,
        status: 'undone',
      },
    });
  });

  it('rejects undo by a different non-admin user', async () => {
    const { service } = createService({
      find: {
        ...row,
        requestedByUserId: '129edcb2-eabf-4361-84c6-bb2441ec92a2',
      },
    });

    await expect(
      service.undoPendingDecision({
        workspaceContext: {
          ...workspaceContext,
          membership: {
            ...workspaceContext.membership,
            userId: '81ace51a-9c22-43ae-a5d5-f2ba057fb36c',
            isAdmin: false,
          },
        },
        decisionId: row.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for another workspace decision id', async () => {
    const { service } = createService({ find: undefined });

    await expect(
      service.undoPendingDecision({
        workspaceContext,
        decisionId: row.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns conflict when undo races an already committed decision', async () => {
    const { service } = createService({
      find: { ...row, status: 'committed', committedAt: new Date('2026-07-01T09:10:01.000Z') },
    });

    await expect(
      service.undoPendingDecision({
        workspaceContext,
        decisionId: row.id,
        now: new Date('2026-07-01T09:05:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns conflict when undo is requested after expiry', async () => {
    const { service } = createService();

    await expect(
      service.undoPendingDecision({
        workspaceContext,
        decisionId: row.id,
        now: new Date('2026-07-01T09:10:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('marks expired decisions committed for worker callers', async () => {
    const { auditService, repository, service } = createService();

    await expect(
      service.markExpiredDecisionCommitted({
        workspaceId: row.workspaceId,
        decisionId: row.id,
        now: new Date('2026-07-01T09:12:00.000Z'),
      }),
    ).resolves.toMatchObject({
      id: row.id,
      status: 'committed',
      remainingSeconds: 0,
    });

    expect(repository.commitExpired).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      decisionId: row.id,
      now: new Date('2026-07-01T09:12:00.000Z'),
    });
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'client',
        action: 'grace_window.committed',
      }),
    );
  });
});
