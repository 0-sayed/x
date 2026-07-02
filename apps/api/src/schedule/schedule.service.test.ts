import { BadRequestException, ConflictException } from '@nestjs/common';
import type { WorkspaceContext } from '@materiabill/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleService } from './schedule.service.js';

const now = new Date('2026-07-02T10:00:00.000Z');
const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const projectId = '33333333-3333-4333-8333-333333333333';
const phaseId = '44444444-4444-4444-8444-444444444444';
const milestoneId = '55555555-5555-4555-8555-555555555555';
const actorUserId = '3f43835d-7f3b-4b16-907b-d57db49832dd';
const drawItemId = '66666666-6666-4666-8666-666666666666';
const baselineId = '99999999-9999-4999-8999-999999999999';
const baselineMilestoneId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const workspaceContext: WorkspaceContext = {
  workspace: {
    id: workspaceId,
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: actorUserId,
    roleKey: 'workspace_admin',
    permissions: ['schedule.view', 'schedule.manage', 'schedule.propose_baseline'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

const project = {
  id: projectId,
  workspaceId,
  archivedAt: null,
};

const phase = {
  id: phaseId,
  workspaceId,
  projectId,
  name: 'Structure',
  startsOn: '2026-08-01',
  endsOn: '2026-08-31',
  displayOrder: 10,
  createdAt: now,
  updatedAt: now,
};

const milestone = {
  id: milestoneId,
  workspaceId,
  projectId,
  phaseId,
  name: 'Slab complete',
  description: null,
  forecastDate: '2026-08-20',
  completedAt: null,
  completedByUserId: null,
  displayOrder: 10,
  createdAt: now,
  updatedAt: now,
};

const schedule = {
  phases: [phase],
  milestones: [milestone],
  drawLinks: [{ workspaceId, milestoneId, drawItemId, createdAt: now }],
  forecastMoves: [],
  baseline: null,
  baselineMilestones: [],
};

type MockFn = ReturnType<typeof vi.fn>;

type RepositoryMock = {
  findProject: MockFn;
  listSchedule: MockFn;
  moveForecastDate: MockFn;
  completeMilestone: MockFn;
  proposeBaseline: MockFn;
  selfCertifyBaseline: MockFn;
  markBaselineAgreedBySignOff: MockFn;
  replaceDrawLinks: MockFn;
};

describe('ScheduleService', () => {
  let repository: RepositoryMock;
  let auditService: { recordEvent: MockFn };
  let realtimePublisher: { publish: MockFn };
  let signOffsService: { createSignOff: MockFn };
  let registry: { register: MockFn };
  let service: ScheduleService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    repository = {
      findProject: vi.fn().mockResolvedValue(project),
      listSchedule: vi.fn().mockResolvedValue(schedule),
      moveForecastDate: vi.fn(),
      completeMilestone: vi.fn(),
      proposeBaseline: vi.fn(),
      selfCertifyBaseline: vi.fn(),
      markBaselineAgreedBySignOff: vi.fn(),
      replaceDrawLinks: vi.fn(),
    };
    auditService = { recordEvent: vi.fn().mockResolvedValue({}) };
    realtimePublisher = { publish: vi.fn() };
    signOffsService = {
      createSignOff: vi.fn().mockResolvedValue({
        id: '77777777-7777-4777-8777-777777777777',
      }),
    };
    registry = { register: vi.fn() };
    service = new ScheduleService(
      repository as unknown as ConstructorParameters<typeof ScheduleService>[0],
      auditService as unknown as ConstructorParameters<typeof ScheduleService>[1],
      realtimePublisher as unknown as ConstructorParameters<typeof ScheduleService>[2],
      signOffsService as unknown as ConstructorParameters<typeof ScheduleService>[3],
      registry as unknown as ConstructorParameters<typeof ScheduleService>[4],
    );
  });

  it('returns a serialized schedule with draw link ids grouped by milestone', async () => {
    const response = await service.getSchedule(workspaceContext, projectId);

    expect(response.milestones[0]?.drawItemIds).toEqual([drawItemId]);
    expect(response.phases[0]?.createdAt).toBe('2026-07-02T10:00:00.000Z');
  });

  it('rejects forecast moves without a reason before repository writes', async () => {
    await expect(
      service.moveForecastDate(workspaceContext, projectId, milestoneId, {
        forecastDate: '2026-09-01',
        reason: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.moveForecastDate).not.toHaveBeenCalled();
  });

  it('includes validation issue details when schedule request parsing fails', async () => {
    await expect(
      service.moveForecastDate(workspaceContext, projectId, milestoneId, {
        forecastDate: 'not-a-date',
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Moving a forecast date requires a forecastDate and reason',
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ['forecastDate'] }),
          expect.objectContaining({ path: ['reason'] }),
        ]),
      }),
    });
  });

  it('moves a forecast date, records client audit, and publishes realtime', async () => {
    repository.moveForecastDate.mockResolvedValueOnce({
      milestone: { ...milestone, forecastDate: '2026-09-01' },
      move: {
        id: '88888888-8888-4888-8888-888888888888',
        workspaceId,
        projectId,
        milestoneId,
        oldForecastDate: '2026-08-20',
        newForecastDate: '2026-09-01',
        reason: 'Supplier delay',
        movedByUserId: actorUserId,
        movedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const response = await service.moveForecastDate(workspaceContext, projectId, milestoneId, {
      forecastDate: '2026-09-01',
      reason: 'Supplier delay',
    });

    expect(response.newForecastDate).toBe('2026-09-01');
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'schedule.forecast_moved', audience: 'client' }),
    );
    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'schedule.forecast.moved' }),
    );
  });

  it('completes a milestone once and publishes schedule.milestone.completed', async () => {
    repository.completeMilestone.mockResolvedValueOnce({
      ...milestone,
      completedAt: now,
      completedByUserId: actorUserId,
    });

    const response = await service.completeMilestone(workspaceContext, projectId, milestoneId);

    expect(response.completedAt).toBe('2026-07-02T10:00:00.000Z');
    expect(realtimePublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'schedule.milestone.completed' }),
    );
  });

  it('proposes a baseline by snapshotting milestones and creating a client sign-off', async () => {
    repository.proposeBaseline.mockResolvedValueOnce({
      baseline: {
        id: baselineId,
        workspaceId,
        projectId,
        status: 'proposed',
        proposedByUserId: actorUserId,
        signOffId: '77777777-7777-4777-8777-777777777777',
        selfCertifiedByUserId: null,
        selfCertifiedReason: null,
        agreedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      milestones: [
        {
          id: baselineMilestoneId,
          baselineId,
          sourceMilestoneId: milestoneId,
          phaseName: 'Structure',
          milestoneName: 'Slab complete',
          baselineDate: '2026-08-20',
          displayOrder: 10,
        },
      ],
    });

    const baseline = await service.proposeBaseline(workspaceContext, projectId);

    expect(baseline.status).toBe('proposed');
    expect(baseline.milestones[0]?.id).toBe(baselineMilestoneId);
    expect(signOffsService.createSignOff).toHaveBeenCalledWith(
      expect.objectContaining({ assignedAudience: 'client', subjectType: 'timeline_baseline' }),
    );
    expect(repository.proposeBaseline).toHaveBeenCalledWith(
      expect.objectContaining({
        milestones: [
          expect.objectContaining({
            phaseName: 'Structure',
            milestoneName: 'Slab complete',
            baselineDate: '2026-08-20',
          }),
        ],
      }),
    );
  });

  it('rejects reproposing an already proposed baseline before creating another sign-off', async () => {
    repository.listSchedule.mockResolvedValueOnce({
      ...schedule,
      baseline: {
        id: baselineId,
        workspaceId,
        projectId,
        status: 'proposed',
        proposedByUserId: actorUserId,
        signOffId: '77777777-7777-4777-8777-777777777777',
        selfCertifiedByUserId: null,
        selfCertifiedReason: null,
        agreedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await expect(service.proposeBaseline(workspaceContext, projectId)).rejects.toThrow(
      ConflictException,
    );

    expect(signOffsService.createSignOff).not.toHaveBeenCalled();
    expect(repository.proposeBaseline).not.toHaveBeenCalled();
  });

  it('rejects baseline proposal when the schedule has no milestones', async () => {
    repository.listSchedule.mockResolvedValueOnce({ ...schedule, milestones: [] });

    await expect(service.proposeBaseline(workspaceContext, projectId)).rejects.toThrow(
      ConflictException,
    );

    expect(signOffsService.createSignOff).not.toHaveBeenCalled();
  });

  it('self-certifies a baseline with required reason and internal audit', async () => {
    repository.selfCertifyBaseline.mockResolvedValueOnce({
      baseline: {
        id: baselineId,
        workspaceId,
        projectId,
        status: 'self_certified',
        proposedByUserId: null,
        signOffId: null,
        selfCertifiedByUserId: actorUserId,
        selfCertifiedReason: 'Client approved offline',
        agreedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      milestones: [
        {
          id: baselineMilestoneId,
          baselineId,
          sourceMilestoneId: milestoneId,
          phaseName: 'Structure',
          milestoneName: 'Slab complete',
          baselineDate: '2026-08-20',
          displayOrder: 10,
        },
      ],
    });

    const baseline = await service.selfCertifyBaseline(workspaceContext, projectId, {
      reason: 'Client approved offline',
    });

    expect(baseline.status).toBe('self_certified');
    expect(baseline.milestones[0]?.id).toBe(baselineMilestoneId);
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'internal', action: 'schedule.baseline_self_certified' }),
    );
  });

  it('locks a proposed baseline when its timeline_baseline sign-off is approved', async () => {
    repository.markBaselineAgreedBySignOff.mockResolvedValueOnce({
      id: '99999999-9999-4999-8999-999999999999',
      workspaceId,
      projectId,
      status: 'agreed',
      proposedByUserId: actorUserId,
      signOffId: '77777777-7777-4777-8777-777777777777',
      selfCertifiedByUserId: null,
      selfCertifiedReason: null,
      agreedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await service.onTimelineBaselineSignOffResolved(
      {
        id: '77777777-7777-4777-8777-777777777777',
        workspaceId,
        projectId,
        subjectType: 'timeline_baseline',
        subjectId: '99999999-9999-4999-8999-999999999999',
        title: 'Approve timeline baseline',
        summary: null,
        assignedAudience: 'client',
        requiredAction: 'approve',
        status: 'approved',
        requestedByUserId: actorUserId,
        resolvedByUserId: actorUserId,
        resolutionReason: null,
        resolutionDecisionId: null,
        lastReminderAt: null,
        reminderCount: 0,
        createdAt: now,
        updatedAt: now,
        resolvedAt: now,
      },
      {
        actorUserId,
        decisionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        resolvedAt: now,
      },
    );

    expect(repository.markBaselineAgreedBySignOff).toHaveBeenCalledWith({
      workspaceId,
      signOffId: '77777777-7777-4777-8777-777777777777',
      agreedAt: now,
    });
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'schedule.baseline_agreed' }),
    );
  });
});
