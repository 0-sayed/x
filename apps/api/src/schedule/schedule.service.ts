import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import {
  createScheduleMilestoneRequestSchema,
  createSchedulePhaseRequestSchema,
  moveForecastDateRequestSchema,
  replaceMilestoneDrawLinksRequestSchema,
  scheduleBaselineSchema,
  scheduleForecastMoveSchema,
  scheduleMilestoneSchema,
  schedulePhaseSchema,
  scheduleResponseSchema,
  selfCertifyBaselineRequestSchema,
  updateScheduleMilestoneRequestSchema,
  updateSchedulePhaseRequestSchema,
  type MoveForecastDateRequest,
  type ReplaceMilestoneDrawLinksRequest,
  type ScheduleBaseline,
  type ScheduleForecastMove,
  type ScheduleMilestone,
  type SchedulePhase,
  type ScheduleResponse,
  type SelfCertifyBaselineRequest,
  type WorkspaceContext,
} from '@materiabill/contracts';
import type {
  ScheduleBaselineMilestoneRecord,
  ScheduleBaselineRecord,
  ScheduleForecastMoveRecord,
  ScheduleMilestoneRecord,
  SchedulePhaseRecord,
  SignOffRecord,
} from '@materiabill/db';
import { randomUUID } from 'node:crypto';

import { AuditService } from '../audit/audit.service.js';
import { RealtimePublisher } from '../realtime/realtime.publisher.js';
import {
  SignOffResolutionHandlerRegistry,
  type SignOffResolutionContext,
} from '../sign-offs/sign-off-resolution-handlers.js';
import { SignOffsService } from '../sign-offs/sign-offs.service.js';
import { ScheduleRepository } from './schedule.repository.js';
import type { BaselineSnapshotItemInput, ScheduleReadModel } from './schedule.types.js';

type RequestSchema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
};

@Injectable()
export class ScheduleService implements OnModuleInit {
  constructor(
    @Inject(ScheduleRepository)
    private readonly repository: ScheduleRepository,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(RealtimePublisher)
    private readonly realtimePublisher: RealtimePublisher,
    @Inject(SignOffsService)
    private readonly signOffsService: SignOffsService,
    @Inject(SignOffResolutionHandlerRegistry)
    private readonly signOffResolutionHandlers: SignOffResolutionHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.signOffResolutionHandlers.register({
      subjectType: 'timeline_baseline',
      handle: async (signOff, context) => {
        await this.onTimelineBaselineSignOffResolved(signOff, context);
      },
    });
  }

  async getSchedule(
    workspaceContext: WorkspaceContext,
    projectId: string,
  ): Promise<ScheduleResponse> {
    await this.requireProject(workspaceContext.workspace.id, projectId);
    return this.toScheduleResponse(
      projectId,
      await this.repository.listSchedule({
        workspaceId: workspaceContext.workspace.id,
        projectId,
      }),
    );
  }

  async createPhase(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<SchedulePhase> {
    const parsed = parseRequest(
      createSchedulePhaseRequestSchema,
      body,
      'Invalid schedule phase request',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const phase = await this.repository.createPhase({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
      projectId,
      now: new Date(),
    });
    if (!phase) throw new NotFoundException('Project or phase not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.phase_created',
      'schedule_phase',
      phase.id,
    );
    return this.toPhase(phase);
  }

  async updatePhase(
    workspaceContext: WorkspaceContext,
    projectId: string,
    phaseId: string,
    body: unknown,
  ): Promise<SchedulePhase> {
    const parsed = parseRequest(
      updateSchedulePhaseRequestSchema,
      body,
      'Invalid schedule phase request',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const phase = await this.repository.updatePhase({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
      projectId,
      phaseId,
      now: new Date(),
    });
    if (!phase) throw new NotFoundException('Schedule phase not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.phase_updated',
      'schedule_phase',
      phase.id,
    );
    return this.toPhase(phase);
  }

  async createMilestone(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<ScheduleMilestone> {
    const parsed = parseRequest(
      createScheduleMilestoneRequestSchema,
      body,
      'Invalid schedule milestone request',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const milestone = await this.repository.createMilestone({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
      projectId,
      now: new Date(),
    });
    if (!milestone) throw new NotFoundException('Schedule phase not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.milestone_created',
      'schedule_milestone',
      milestone.id,
    );
    return this.toMilestone(milestone, []);
  }

  async updateMilestone(
    workspaceContext: WorkspaceContext,
    projectId: string,
    milestoneId: string,
    body: unknown,
  ): Promise<ScheduleMilestone> {
    const parsed = parseRequest(
      updateScheduleMilestoneRequestSchema,
      body,
      'Invalid schedule milestone request',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const milestone = await this.repository.updateMilestone({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
      projectId,
      milestoneId,
      now: new Date(),
    });
    if (!milestone) throw new NotFoundException('Schedule milestone not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.milestone_updated',
      'schedule_milestone',
      milestone.id,
    );
    return this.toMilestone(milestone, []);
  }

  async moveForecastDate(
    workspaceContext: WorkspaceContext,
    projectId: string,
    milestoneId: string,
    body: unknown,
  ): Promise<ScheduleForecastMove> {
    const parsed = parseRequest<MoveForecastDateRequest>(
      moveForecastDateRequestSchema,
      body,
      'Moving a forecast date requires a forecastDate and reason',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const result = await this.repository.moveForecastDate({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      milestoneId,
      forecastDate: parsed.forecastDate,
      reason: parsed.reason,
      movedByUserId: workspaceContext.membership.userId,
      now: new Date(),
    });
    if (!result) throw new NotFoundException('Schedule milestone not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.forecast_moved',
      'schedule_milestone',
      milestoneId,
      {
        reason: result.move.reason,
        oldForecastDate: result.move.oldForecastDate,
        newForecastDate: result.move.newForecastDate,
      },
    );
    this.realtimePublisher.publish({
      workspaceId: workspaceContext.workspace.id,
      type: 'schedule.forecast.moved',
      payload: { projectId, milestoneId, forecastDate: result.move.newForecastDate },
    });

    return this.toForecastMove(result.move);
  }

  async completeMilestone(
    workspaceContext: WorkspaceContext,
    projectId: string,
    milestoneId: string,
  ): Promise<ScheduleMilestone> {
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const milestone = await this.repository.completeMilestone({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      milestoneId,
      completedByUserId: workspaceContext.membership.userId,
      now: new Date(),
    });
    if (!milestone) throw new ConflictException('Schedule milestone is already complete');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.milestone_completed',
      'schedule_milestone',
      milestone.id,
    );
    this.realtimePublisher.publish({
      workspaceId: workspaceContext.workspace.id,
      type: 'schedule.milestone.completed',
      payload: { projectId, milestoneId: milestone.id },
    });

    return this.toMilestone(milestone, []);
  }

  async replaceDrawLinks(
    workspaceContext: WorkspaceContext,
    projectId: string,
    milestoneId: string,
    body: unknown,
  ): Promise<ScheduleMilestone> {
    const parsed = parseRequest<ReplaceMilestoneDrawLinksRequest>(
      replaceMilestoneDrawLinksRequestSchema,
      body,
      'Invalid milestone draw link request',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const links = await this.repository.replaceDrawLinks({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      milestoneId,
      drawItemIds: parsed.drawItemIds,
    });
    if (!links) throw new NotFoundException('Schedule milestone not found');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.draw_links_replaced',
      'schedule_milestone',
      milestoneId,
      { drawItemIds: links.map((link) => link.drawItemId) },
    );

    const schedule = await this.repository.listSchedule({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    const milestone = schedule.milestones.find((row) => row.id === milestoneId);
    if (!milestone) throw new NotFoundException('Schedule milestone not found');
    return this.toMilestone(
      milestone,
      links.map((link) => link.drawItemId),
    );
  }

  async proposeBaseline(
    workspaceContext: WorkspaceContext,
    projectId: string,
  ): Promise<ScheduleBaseline> {
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const schedule = await this.repository.listSchedule({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    const milestones = this.toBaselineSnapshotRows(schedule);
    if (milestones.length === 0) {
      throw new ConflictException('Cannot propose a baseline without milestones');
    }

    const baselineId =
      schedule.baseline?.status === 'proposed' ? schedule.baseline.id : randomUUID();
    const signOff = await this.signOffsService.createSignOff({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      subjectType: 'timeline_baseline',
      subjectId: baselineId,
      title: 'Approve timeline baseline',
      summary: 'Client approval locks the agreed timeline baseline.',
      assignedAudience: 'client',
      requiredAction: 'approve',
      requestedByUserId: workspaceContext.membership.userId,
    });
    const baseline = await this.repository.proposeBaseline({
      baselineId,
      workspaceId: workspaceContext.workspace.id,
      projectId,
      proposedByUserId: workspaceContext.membership.userId,
      signOffId: signOff.id,
      milestones,
      now: new Date(),
    });
    if (!baseline) throw new ConflictException('Timeline baseline could not be proposed');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.baseline_proposed',
      'schedule_baseline',
      baseline.id,
      { signOffId: signOff.id },
    );
    this.realtimePublisher.publish({
      workspaceId: workspaceContext.workspace.id,
      type: 'schedule.baseline.changed',
      payload: { projectId, baselineId: baseline.id, status: baseline.status },
    });

    return this.toBaseline(baseline, milestonesToRecords(baseline.id, milestones));
  }

  async selfCertifyBaseline(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<ScheduleBaseline> {
    const parsed = parseRequest<SelfCertifyBaselineRequest>(
      selfCertifyBaselineRequestSchema,
      body,
      'Manual baseline self-certification requires a reason',
    );
    await this.requireWritableProject(workspaceContext.workspace.id, projectId);
    const schedule = await this.repository.listSchedule({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    const milestones = this.toBaselineSnapshotRows(schedule);
    if (milestones.length === 0) {
      throw new ConflictException('Cannot self-certify a baseline without milestones');
    }

    const baseline = await this.repository.selfCertifyBaseline({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      selfCertifiedByUserId: workspaceContext.membership.userId,
      reason: parsed.reason,
      milestones,
      now: new Date(),
    });
    if (!baseline) throw new ConflictException('Timeline baseline could not be self-certified');

    await this.recordAudit(
      workspaceContext,
      projectId,
      'schedule.baseline_self_certified',
      'schedule_baseline',
      baseline.id,
      { reason: parsed.reason },
      'internal',
    );
    this.realtimePublisher.publish({
      workspaceId: workspaceContext.workspace.id,
      type: 'schedule.baseline.changed',
      payload: { projectId, baselineId: baseline.id, status: baseline.status },
    });

    return this.toBaseline(baseline, milestonesToRecords(baseline.id, milestones));
  }

  async onTimelineBaselineSignOffResolved(
    signOff: SignOffRecord,
    context: SignOffResolutionContext,
  ): Promise<void> {
    if (signOff.subjectType !== 'timeline_baseline' || signOff.status !== 'approved') return;

    const baseline = await this.repository.markBaselineAgreedBySignOff({
      workspaceId: signOff.workspaceId,
      signOffId: signOff.id,
      agreedAt: context.resolvedAt,
    });
    if (!baseline) throw new ConflictException('Timeline baseline is no longer proposed');

    await this.auditService.recordEvent({
      workspaceId: signOff.workspaceId,
      actorUserId: context.actorUserId,
      audience: 'client',
      action: 'schedule.baseline_agreed',
      resourceType: 'schedule_baseline',
      resourceId: baseline.id,
      metadata: { projectId: baseline.projectId, signOffId: signOff.id },
      occurredAt: context.resolvedAt,
    });
    this.realtimePublisher.publish({
      workspaceId: signOff.workspaceId,
      type: 'schedule.baseline.changed',
      payload: { projectId: baseline.projectId, baselineId: baseline.id, status: baseline.status },
      occurredAt: context.resolvedAt,
    });
  }

  private async requireProject(workspaceId: string, projectId: string): Promise<void> {
    const project = await this.repository.findProject({ workspaceId, projectId });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async requireWritableProject(workspaceId: string, projectId: string): Promise<void> {
    const project = await this.repository.findProject({ workspaceId, projectId });
    if (!project) throw new NotFoundException('Project not found');
    if (project.archivedAt)
      throw new ConflictException('Archived project schedule cannot be edited');
  }

  private toBaselineSnapshotRows(schedule: ScheduleReadModel): BaselineSnapshotItemInput[] {
    const phaseById = new Map(schedule.phases.map((phase) => [phase.id, phase]));
    return schedule.milestones.map((milestone) => {
      const phase = phaseById.get(milestone.phaseId);
      if (!phase) throw new ConflictException('Milestone phase is missing');
      return {
        sourceMilestoneId: milestone.id,
        phaseName: phase.name,
        milestoneName: milestone.name,
        baselineDate: milestone.forecastDate,
        displayOrder: milestone.displayOrder,
      };
    });
  }

  private toScheduleResponse(projectId: string, schedule: ScheduleReadModel): ScheduleResponse {
    const drawLinksByMilestoneId = new Map<string, string[]>();
    for (const link of schedule.drawLinks) {
      const links = drawLinksByMilestoneId.get(link.milestoneId) ?? [];
      links.push(link.drawItemId);
      drawLinksByMilestoneId.set(link.milestoneId, links);
    }

    return scheduleResponseSchema.parse({
      projectId,
      phases: schedule.phases.map((phase) => this.toPhase(phase)),
      milestones: schedule.milestones.map((milestone) =>
        this.toMilestone(milestone, drawLinksByMilestoneId.get(milestone.id) ?? []),
      ),
      baseline: schedule.baseline
        ? this.toBaseline(schedule.baseline, schedule.baselineMilestones)
        : null,
      forecastMoves: schedule.forecastMoves.map((move) => this.toForecastMove(move)),
    });
  }

  private toPhase(row: SchedulePhaseRecord): SchedulePhase {
    return schedulePhaseSchema.parse({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private toMilestone(
    row: ScheduleMilestoneRecord,
    drawItemIds: readonly string[],
  ): ScheduleMilestone {
    return scheduleMilestoneSchema.parse({
      ...row,
      drawItemIds,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private toBaseline(
    row: ScheduleBaselineRecord,
    milestones: readonly ScheduleBaselineMilestoneRecord[],
  ): ScheduleBaseline {
    return scheduleBaselineSchema.parse({
      ...row,
      agreedAt: row.agreedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      milestones,
    });
  }

  private toForecastMove(row: ScheduleForecastMoveRecord): ScheduleForecastMove {
    return scheduleForecastMoveSchema.parse({
      id: row.id,
      workspaceId: row.workspaceId,
      projectId: row.projectId,
      milestoneId: row.milestoneId,
      oldForecastDate: row.oldForecastDate,
      newForecastDate: row.newForecastDate,
      reason: row.reason,
      movedByUserId: row.movedByUserId,
      movedAt: row.movedAt.toISOString(),
    });
  }

  private async recordAudit(
    workspaceContext: WorkspaceContext,
    projectId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
    audience: 'client' | 'internal' = 'client',
  ): Promise<void> {
    await this.auditService.recordEvent({
      workspaceId: workspaceContext.workspace.id,
      actorUserId: workspaceContext.membership.userId,
      audience,
      action,
      resourceType,
      resourceId,
      metadata: { projectId, ...metadata },
    });
  }
}

function parseRequest<T>(schema: RequestSchema<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException(message);
  return parsed.data;
}

function milestonesToRecords(
  baselineId: string,
  milestones: readonly BaselineSnapshotItemInput[],
): ScheduleBaselineMilestoneRecord[] {
  return milestones.map((milestone, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    baselineId,
    sourceMilestoneId: milestone.sourceMilestoneId,
    phaseName: milestone.phaseName,
    milestoneName: milestone.milestoneName,
    baselineDate: milestone.baselineDate,
    displayOrder: milestone.displayOrder,
  }));
}
