import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { CurrentSessionUser } from '@materiabill/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceMembershipRecord } from './workspace-context.repository.js';
import { WorkspaceContextService } from './workspace-context.service.js';

const user: CurrentSessionUser = {
  id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
  email: 'admin@example.com',
  displayName: 'Admin User',
  phone: null,
  avatarUrl: null,
  activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  workspaces: [
    {
      id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      roleKey: 'workspace_admin',
      permissions: ['workspace.view'],
      isAdmin: true,
    },
    {
      id: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      name: 'Second Workspace',
      slug: 'second-workspace',
      roleKey: 'member',
      permissions: ['workspace.view'],
      isAdmin: false,
    },
  ],
};

const membership: WorkspaceMembershipRecord = {
  workspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
  workspaceName: 'Second Workspace',
  workspaceSlug: 'second-workspace',
  paymentCurrency: 'SAR',
  userId: user.id,
  roleKey: 'member',
  permissions: ['workspace.view'],
  isAdmin: false,
};

function createService(record: WorkspaceMembershipRecord | null = membership) {
  const repository = {
    findMembershipContext: vi.fn().mockResolvedValue(record),
    updateActiveWorkspace: vi.fn().mockResolvedValue(true),
  };

  return {
    repository,
    service: new WorkspaceContextService(repository as never),
  };
}

describe('WorkspaceContextService', () => {
  it('prefers the explicit header workspace id over the active session workspace', async () => {
    const { repository, service } = createService();

    await expect(
      service.resolveForRequest({
        user,
        requestedWorkspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      }),
    ).resolves.toEqual({
      workspace: {
        id: membership.workspaceId,
        name: membership.workspaceName,
        slug: membership.workspaceSlug,
        paymentCurrency: 'SAR',
      },
      membership: {
        userId: user.id,
        roleKey: 'member',
        permissions: ['workspace.view'],
        isAdmin: false,
      },
      access: {
        appInstalled: true,
        subscriptionActive: true,
        membershipActive: true,
      },
    });

    expect(repository.findMembershipContext).toHaveBeenCalledWith(
      user.id,
      '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
    );
  });

  it('falls back to the first workspace when no active workspace is set', async () => {
    const { repository, service } = createService({
      ...membership,
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      workspaceName: 'Demo Workspace',
      workspaceSlug: 'demo-workspace',
      roleKey: 'workspace_admin',
      isAdmin: true,
    });

    await service.resolveForRequest({
      user: { ...user, activeWorkspaceId: null },
      requestedWorkspaceId: undefined,
    });

    expect(repository.findMembershipContext).toHaveBeenCalledWith(
      user.id,
      '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    );
  });

  it('uses the active session workspace before the first workspace fallback', async () => {
    const { repository, service } = createService({
      ...membership,
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      workspaceName: 'Demo Workspace',
      workspaceSlug: 'demo-workspace',
      roleKey: 'workspace_admin',
      isAdmin: true,
    });

    await service.resolveForRequest({
      user,
      requestedWorkspaceId: undefined,
    });

    expect(repository.findMembershipContext).toHaveBeenCalledWith(
      user.id,
      '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    );
  });

  it('rejects malformed explicit workspace ids', async () => {
    const { service } = createService();

    await expect(
      service.resolveForRequest({ user, requestedWorkspaceId: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts UUID versions supported by the shared contract', async () => {
    const uuidV7 = '01890f8e-5f47-7cc3-98c4-dc0c0c07398f';
    const { repository, service } = createService({ ...membership, workspaceId: uuidV7 });

    await service.resolveForRequest({ user, requestedWorkspaceId: uuidV7 });

    expect(repository.findMembershipContext).toHaveBeenCalledWith(user.id, uuidV7);
  });

  it('rejects missing or inactive memberships', async () => {
    const { service } = createService(null);

    await expect(
      service.resolveForRequest({
        user,
        requestedWorkspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updates the active workspace only after membership is verified', async () => {
    const { repository, service } = createService();

    await expect(
      service.switchActiveWorkspace({
        sessionId: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        user,
        workspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      }),
    ).resolves.toEqual({
      activeWorkspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      workspaces: user.workspaces,
    });

    expect(repository.updateActiveWorkspace).toHaveBeenCalledWith(
      'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
      user.id,
      '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
    );
    expect(repository.findMembershipContext.mock.invocationCallOrder[0]).toBeLessThan(
      repository.updateActiveWorkspace.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('rejects active workspace switches when the session update matches no row', async () => {
    const { repository, service } = createService();
    repository.updateActiveWorkspace.mockResolvedValue(false);

    await expect(
      service.switchActiveWorkspace({
        sessionId: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2',
        user,
        workspaceId: '219cc5f7-6bf0-40fe-87c8-c550ee501af6',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
