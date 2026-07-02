import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  projectIdSchema,
  scheduleMilestoneIdSchema,
  schedulePhaseIdSchema,
  type WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';

import { RequirePermissions } from '../permissions/permissions.decorator.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { ScheduleService } from './schedule.service.js';

@Controller('projects/:projectId/schedule')
@UseGuards(WorkspaceContextGuard, PermissionsGuard)
export class ScheduleController {
  constructor(
    @Inject(ScheduleService)
    private readonly scheduleService: ScheduleService,
  ) {}

  @Get()
  @RequirePermissions('schedule.view')
  getSchedule(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.scheduleService.getSchedule(workspaceContext, parseProjectId(projectId));
  }

  @Post('phases')
  @RequirePermissions('schedule.manage')
  createPhase(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.createPhase(workspaceContext, parseProjectId(projectId), body);
  }

  @Patch('phases/:phaseId')
  @RequirePermissions('schedule.manage')
  updatePhase(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.updatePhase(
      workspaceContext,
      parseProjectId(projectId),
      parsePhaseId(phaseId),
      body,
    );
  }

  @Post('milestones')
  @RequirePermissions('schedule.manage')
  createMilestone(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.createMilestone(workspaceContext, parseProjectId(projectId), body);
  }

  @Patch('milestones/:milestoneId')
  @RequirePermissions('schedule.manage')
  updateMilestone(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.updateMilestone(
      workspaceContext,
      parseProjectId(projectId),
      parseMilestoneId(milestoneId),
      body,
    );
  }

  @Post('milestones/:milestoneId/forecast-date')
  @RequirePermissions('schedule.manage')
  moveForecastDate(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.moveForecastDate(
      workspaceContext,
      parseProjectId(projectId),
      parseMilestoneId(milestoneId),
      body,
    );
  }

  @Post('milestones/:milestoneId/complete')
  @RequirePermissions('milestones.complete')
  completeMilestone(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    return this.scheduleService.completeMilestone(
      workspaceContext,
      parseProjectId(projectId),
      parseMilestoneId(milestoneId),
    );
  }

  @Put('milestones/:milestoneId/draw-links')
  @RequirePermissions('schedule.manage')
  replaceDrawLinks(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.replaceDrawLinks(
      workspaceContext,
      parseProjectId(projectId),
      parseMilestoneId(milestoneId),
      body,
    );
  }

  @Post('baseline/propose')
  @RequirePermissions('schedule.propose_baseline')
  proposeBaseline(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.scheduleService.proposeBaseline(workspaceContext, parseProjectId(projectId));
  }

  @Post('baseline/self-certify')
  @RequirePermissions('schedule.propose_baseline')
  selfCertifyBaseline(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.scheduleService.selfCertifyBaseline(
      workspaceContext,
      parseProjectId(projectId),
      body,
    );
  }
}

function parseProjectId(projectId: string): string {
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) throw new BadRequestException('Invalid project id');
  return parsed.data;
}

function parsePhaseId(phaseId: string): string {
  const parsed = schedulePhaseIdSchema.safeParse(phaseId);
  if (!parsed.success) throw new BadRequestException('Invalid phase id');
  return parsed.data;
}

function parseMilestoneId(milestoneId: string): string {
  const parsed = scheduleMilestoneIdSchema.safeParse(milestoneId);
  if (!parsed.success) throw new BadRequestException('Invalid milestone id');
  return parsed.data;
}
