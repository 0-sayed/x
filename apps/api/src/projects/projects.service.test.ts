import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ProjectsService } from './projects.service.js';

const workspaceContext = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Acme',
    slug: 'acme',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: null,
    permissions: ['projects.view', 'projects.create', 'projects.edit', 'projects.archive'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
} as const;

function createRepositoryMock() {
  const project = {
    id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
    workspaceId: workspaceContext.workspace.id,
    name: 'Villa A12',
    city: 'Riyadh',
    currency: 'SAR',
    status: 'on_plan',
    now: null,
    bottleneck: null,
    baselineDeliveryDate: '2026-12-15',
    pmUserId: null,
    locationId: null,
    endCustomerId: '11111111-1111-4111-8111-111111111111',
    clientOrgId: null,
    createdByUserId: workspaceContext.membership.userId,
    archivedAt: null,
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    updatedAt: new Date('2026-07-01T09:00:00.000Z'),
  };

  const participants = [
    {
      projectId: project.id,
      workspaceId: project.workspaceId,
      userId: workspaceContext.membership.userId,
      roleLabel: 'Project Manager',
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:00:00.000Z'),
    },
  ];

  return {
    project,
    participants,
    repository: {
      createProject: vi.fn().mockResolvedValue(project),
      listProjects: vi.fn().mockResolvedValue([{ ...project, participantCount: 1 }]),
      findProject: vi.fn().mockResolvedValue(project),
      findProjectDetail: vi
        .fn()
        .mockResolvedValue({ ...project, participantCount: 1, participants }),
      updateProject: vi.fn().mockResolvedValue({
        ...project,
        name: 'Villa A12 Phase 2',
        updatedAt: new Date('2026-07-01T10:00:00.000Z'),
      }),
      archiveProject: vi.fn().mockResolvedValue({
        ...project,
        archivedAt: new Date('2026-07-01T10:00:00.000Z'),
        updatedAt: new Date('2026-07-01T10:00:00.000Z'),
      }),
      listParticipants: vi.fn().mockResolvedValue(participants),
      replaceParticipants: vi.fn().mockResolvedValue(participants),
      findActiveMembershipUserIds: vi
        .fn()
        .mockResolvedValue(new Set([workspaceContext.membership.userId])),
    },
  };
}

function createService() {
  const { repository, project, participants } = createRepositoryMock();
  const auditService = { recordEvent: vi.fn().mockResolvedValue(undefined) };
  const clientIdentitiesService = { identityExists: vi.fn().mockResolvedValue(true) };

  return {
    project,
    participants,
    repository,
    auditService,
    clientIdentitiesService,
    service: new ProjectsService(
      repository as never,
      auditService as never,
      clientIdentitiesService as never,
    ),
  };
}

function toApiProject(project: ReturnType<typeof createRepositoryMock>['project']) {
  const { createdByUserId, ...rest } = project;

  void createdByUserId;

  return rest;
}

describe('ProjectsService', () => {
  it('creates projects and records an internal audit event', async () => {
    const { service, repository, auditService, project } = createService();

    await expect(
      service.createProject(workspaceContext as never, {
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        baselineDeliveryDate: '2026-12-15',
        endCustomerId: '11111111-1111-4111-8111-111111111111',
      }),
    ).resolves.toEqual({
      ...toApiProject(project),
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      archivedAt: null,
      participantCount: 0,
      participants: [],
    });

    expect(repository.createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceContext.workspace.id,
        createdByUserId: workspaceContext.membership.userId,
        status: 'on_plan',
        now: null,
        bottleneck: null,
        pmUserId: null,
        locationId: null,
        endCustomerId: '11111111-1111-4111-8111-111111111111',
        clientOrgId: null,
      }),
    );
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceContext.workspace.id,
        actorUserId: workspaceContext.membership.userId,
        audience: 'internal',
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
      }),
    );
  });

  it('rejects create requests without exactly one client reference', async () => {
    const { service, repository } = createService();

    await expect(
      service.createProject(workspaceContext as never, {
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        baselineDeliveryDate: '2026-12-15',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createProject).not.toHaveBeenCalled();
  });

  it('rejects missing end-customer identities before inserting projects', async () => {
    const { service, repository, clientIdentitiesService } = createService();
    clientIdentitiesService.identityExists.mockResolvedValue(false);

    await expect(
      service.createProject(workspaceContext as never, {
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        baselineDeliveryDate: '2026-12-15',
        endCustomerId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createProject).not.toHaveBeenCalled();
  });

  it('lists projects and returns a stable next cursor only when the page is full', async () => {
    const { service, repository, project } = createService();

    await expect(
      service.listProjects(workspaceContext as never, { limit: 1, includeArchived: 'false' }),
    ).resolves.toEqual({
      projects: [
        {
          ...toApiProject(project),
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
          archivedAt: null,
          participantCount: 1,
        },
      ],
      nextCursor: project.id,
    });

    expect(repository.listProjects).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      includeArchived: false,
      limit: 1,
    });
  });

  it('returns project detail with serialized participants', async () => {
    const { service, participants, project } = createService();

    await expect(service.getProject(workspaceContext as never, project.id)).resolves.toEqual({
      ...toApiProject(project),
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T09:00:00.000Z',
      archivedAt: null,
      participantCount: 1,
      participants: [
        {
          ...participants[0],
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        },
      ],
    });
  });

  it('returns not found when the project is outside the workspace', async () => {
    const { service, repository, project } = createService();
    repository.findProject.mockResolvedValue(undefined);

    await expect(service.getProject(workspaceContext as never, project.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects any update body containing baselineDeliveryDate before schema parsing', async () => {
    const { service, repository, project } = createService();

    await expect(
      service.updateProject(workspaceContext as never, project.id, {
        baselineDeliveryDate: '2027-01-01',
        unexpected: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.findProject).not.toHaveBeenCalled();
    expect(repository.updateProject).not.toHaveBeenCalled();
  });

  it('rejects invalid update bodies before loading the project', async () => {
    const { service, repository, project } = createService();

    await expect(
      service.updateProject(workspaceContext as never, project.id, {
        unexpected: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findProject).not.toHaveBeenCalled();
    expect(repository.updateProject).not.toHaveBeenCalled();
  });

  it('rejects updates to archived projects', async () => {
    const { service, repository, project } = createService();
    repository.findProject.mockResolvedValue({
      ...toApiProject(project),
      archivedAt: new Date('2026-07-01T10:00:00.000Z'),
    });

    await expect(
      service.updateProject(workspaceContext as never, project.id, {
        name: 'Villa A12 Phase 2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns conflict when a project is archived before the update write lands', async () => {
    const { service, repository, project } = createService();
    repository.updateProject.mockResolvedValue(undefined);
    repository.findProject.mockResolvedValueOnce(project).mockResolvedValueOnce({
      ...project,
      archivedAt: new Date('2026-07-01T10:00:00.000Z'),
    });

    await expect(
      service.updateProject(workspaceContext as never, project.id, {
        name: 'Villa A12 Phase 2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires update requests to leave exactly one final client reference', async () => {
    const { service, project, repository } = createService();

    await expect(
      service.updateProject(workspaceContext as never, project.id, { endCustomerId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.updateProject).not.toHaveBeenCalled();
  });

  it('updates a project and records an internal audit event', async () => {
    const { service, repository, auditService, participants, project } = createService();

    await expect(
      service.updateProject(workspaceContext as never, project.id, {
        name: 'Villa A12 Phase 2',
        now: 'Chasing permit approval',
      }),
    ).resolves.toEqual({
      ...toApiProject(project),
      name: 'Villa A12 Phase 2',
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      archivedAt: null,
      participantCount: 1,
      participants: [
        {
          ...participants[0],
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        },
      ],
    });

    expect(repository.updateProject).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      projectId: project.id,
      name: 'Villa A12 Phase 2',
      now: 'Chasing permit approval',
    });
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
        action: 'project.updated',
        resourceType: 'project',
        resourceId: project.id,
      }),
    );
  });

  it('archives a project and records an internal audit event', async () => {
    const { service, auditService, participants, project } = createService();

    await expect(service.archiveProject(workspaceContext as never, project.id)).resolves.toEqual({
      ...toApiProject(project),
      createdAt: '2026-07-01T09:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      archivedAt: '2026-07-01T10:00:00.000Z',
      participantCount: 1,
      participants: [
        {
          ...participants[0],
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        },
      ],
    });

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
        action: 'project.archived',
        resourceType: 'project',
        resourceId: project.id,
      }),
    );
  });

  it('lists project participants in contract shape', async () => {
    const { service, participants, project } = createService();

    await expect(service.listParticipants(workspaceContext as never, project.id)).resolves.toEqual({
      participants: [
        {
          ...participants[0],
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        },
      ],
    });
  });

  it('rejects participant replacement when any user is not an active workspace member', async () => {
    const { service, repository, project } = createService();
    repository.findActiveMembershipUserIds.mockResolvedValue(new Set());

    await expect(
      service.replaceParticipants(workspaceContext as never, project.id, {
        participants: [{ userId: workspaceContext.membership.userId, roleLabel: 'PM' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.replaceParticipants).not.toHaveBeenCalled();
  });

  it('rejects invalid participant replacement bodies before loading the project', async () => {
    const { service, repository, project } = createService();

    await expect(
      service.replaceParticipants(workspaceContext as never, project.id, {
        participants: [{ userId: 'not-a-uuid', roleLabel: 'PM' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findProject).not.toHaveBeenCalled();
    expect(repository.findActiveMembershipUserIds).not.toHaveBeenCalled();
    expect(repository.replaceParticipants).not.toHaveBeenCalled();
  });

  it('rejects participant replacement for archived projects', async () => {
    const { service, repository, project } = createService();
    repository.findProject.mockResolvedValue({
      ...project,
      archivedAt: new Date('2026-07-01T10:00:00.000Z'),
    });

    await expect(
      service.replaceParticipants(workspaceContext as never, project.id, {
        participants: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns conflict when participants cannot be replaced because the project is archived', async () => {
    const { service, repository, project } = createService();
    repository.replaceParticipants.mockResolvedValue(undefined);

    await expect(
      service.replaceParticipants(workspaceContext as never, project.id, {
        participants: [
          { userId: workspaceContext.membership.userId, roleLabel: 'Project Manager' },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replaces participants and records an internal audit event', async () => {
    const { service, repository, auditService, participants, project } = createService();

    await expect(
      service.replaceParticipants(workspaceContext as never, project.id, {
        participants: [
          { userId: workspaceContext.membership.userId, roleLabel: 'Project Manager' },
        ],
      }),
    ).resolves.toEqual({
      participants: [
        {
          ...participants[0],
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        },
      ],
    });

    expect(repository.findActiveMembershipUserIds).toHaveBeenCalledWith(
      workspaceContext.workspace.id,
      [workspaceContext.membership.userId],
    );
    expect(repository.replaceParticipants).toHaveBeenCalledWith({
      workspaceId: workspaceContext.workspace.id,
      projectId: project.id,
      participants: [{ userId: workspaceContext.membership.userId, roleLabel: 'Project Manager' }],
    });
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
        action: 'project.participants_replaced',
        resourceType: 'project',
        resourceId: project.id,
      }),
    );
  });
});
