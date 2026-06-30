import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  type WorkspaceContext as WorkspaceContextValue,
  type WorkspaceSwitcherResponse,
  switchWorkspaceRequestSchema,
} from '@materiabill/contracts';

import { SessionGuard } from '../session/session.guard.js';
import { WorkspaceContext } from './workspace-context.decorator.js';
import { WorkspaceContextGuard } from './workspace-context.guard.js';
import { WorkspaceContextService } from './workspace-context.service.js';
import type { WorkspaceScopedRequest } from './workspace-context.types.js';

@Controller()
export class WorkspaceContextController {
  constructor(
    @Inject(WorkspaceContextService)
    private readonly workspaceContextService: WorkspaceContextService,
  ) {}

  @Get('workspaces')
  @UseGuards(SessionGuard)
  workspaces(@Req() request: WorkspaceScopedRequest): WorkspaceSwitcherResponse {
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    return this.workspaceContextService.buildSwitcherResponse(request.user);
  }

  @Get('workspace-context')
  @UseGuards(WorkspaceContextGuard)
  workspaceContext(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
  ): WorkspaceContextValue {
    return workspaceContext;
  }

  @Post('workspaces/active')
  @UseGuards(SessionGuard)
  switchWorkspace(
    @Req() request: WorkspaceScopedRequest,
    @Body() body: unknown,
  ): Promise<WorkspaceSwitcherResponse> {
    if (!request.user || !request.sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedBody = switchWorkspaceRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException('Invalid workspace switch request');
    }

    return this.workspaceContextService.switchActiveWorkspace({
      sessionId: request.sessionId,
      user: request.user,
      workspaceId: parsedBody.data.workspaceId,
    });
  }
}
