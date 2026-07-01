import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { GraceWindowController } from './grace-window.controller.js';

const workspaceContext = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: 'workspace_admin',
    permissions: ['workspace.view'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

function createController() {
  const service = {
    listActivePendingDecisions: vi.fn().mockResolvedValue({ decisions: [] }),
    undoPendingDecision: vi.fn().mockResolvedValue({
      decision: {
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: workspaceContext.workspace.id,
        projectId: null,
        requestedByUserId: workspaceContext.membership.userId,
        status: 'undone',
        audience: 'org',
        decisionType: 'draw.release',
        recordType: 'draw',
        recordId: 'D-104',
        summaryLabel: 'Release draw D-104',
        commitPayload: {},
        undoPayload: {},
        requestedAt: '2026-07-01T09:00:00.000Z',
        expiresAt: '2026-07-01T09:10:00.000Z',
        remainingSeconds: 0,
      },
    }),
  };

  return {
    controller: new GraceWindowController(service as never),
    service,
  };
}

describe('GraceWindowController', () => {
  it('lists active pending decisions for the resolved workspace', async () => {
    const { controller, service } = createController();

    await expect(
      controller.listPendingDecisions(workspaceContext, {
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        limit: '25',
      }),
    ).resolves.toEqual({ decisions: [] });

    expect(service.listActivePendingDecisions).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      limit: 25,
    });
  });

  it('rejects invalid list queries', async () => {
    const { controller } = createController();

    await expect(
      controller.listPendingDecisions(workspaceContext, {
        limit: '1000',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires workspace context', async () => {
    const { controller } = createController();

    await expect(controller.listPendingDecisions(undefined, {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('undoes a pending decision through the service', async () => {
    const { controller, service } = createController();

    await controller.undoPendingDecision(workspaceContext, '01890f8e-5f47-7cc3-98c4-dc0c0c07398f');

    expect(service.undoPendingDecision).toHaveBeenCalledWith({
      workspaceContext,
      decisionId: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
    });
  });

  it('rejects invalid undo ids', async () => {
    const { controller } = createController();

    await expect(
      controller.undoPendingDecision(workspaceContext, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
