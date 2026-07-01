import 'reflect-metadata';

import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { ProjectsController } from './projects.controller.js';

const workspaceContext = {
  workspace: { id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a', name: 'Acme', slug: 'acme' },
  membership: {
    workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: null,
    permissions: ['projects.view'],
    isAdmin: true,
    isActive: true,
  },
} as const;

describe('ProjectsController', () => {
  it('registers guards by class for Nest dependency injection', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectsController)).toEqual([
      WorkspaceContextGuard,
      PermissionsGuard,
    ]);
  });

  it('rejects invalid project ids before calling service', async () => {
    const service = { getProject: vi.fn() };
    const controller = new ProjectsController(service as never);

    await expect(
      controller.getProject(workspaceContext as never, 'not-a-uuid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getProject).not.toHaveBeenCalled();
  });

  it('passes workspace context and query to list service', async () => {
    const service = { listProjects: vi.fn().mockResolvedValue({ projects: [], nextCursor: null }) };
    const controller = new ProjectsController(service as never);

    await controller.listProjects(workspaceContext as never, { limit: '10' });

    expect(service.listProjects).toHaveBeenCalledWith(workspaceContext, { limit: '10' });
  });
});
