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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import { projectIdSchema } from '@materiabill/contracts';

import { RequirePermissions } from '../permissions/permissions.decorator.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { ProjectsService } from './projects.service.js';

const permissionsGuard = new PermissionsGuard(new Reflector());

@Controller('projects')
@UseGuards(WorkspaceContextGuard, permissionsGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @RequirePermissions('projects.view')
  listProjects(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Query() query: unknown,
  ) {
    return this.projectsService.listProjects(workspaceContext, query);
  }

  @Post()
  @RequirePermissions('projects.create')
  createProject(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Body() body: unknown,
  ) {
    return this.projectsService.createProject(workspaceContext, body);
  }

  @Get(':projectId')
  @RequirePermissions('projects.view')
  async getProject(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.getProject(workspaceContext, parseProjectId(projectId));
  }

  @Patch(':projectId')
  @RequirePermissions('projects.edit')
  updateProject(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projectsService.updateProject(workspaceContext, parseProjectId(projectId), body);
  }

  @Post(':projectId/archive')
  @RequirePermissions('projects.archive')
  archiveProject(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.archiveProject(workspaceContext, parseProjectId(projectId));
  }

  @Get(':projectId/participants')
  @RequirePermissions('projects.view')
  listParticipants(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.listParticipants(workspaceContext, parseProjectId(projectId));
  }

  @Put(':projectId/participants')
  @RequirePermissions('projects.edit')
  replaceParticipants(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.projectsService.replaceParticipants(
      workspaceContext,
      parseProjectId(projectId),
      body,
    );
  }
}

function parseProjectId(projectId: string): string {
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) {
    throw new BadRequestException('Invalid project id');
  }
  return parsed.data;
}
