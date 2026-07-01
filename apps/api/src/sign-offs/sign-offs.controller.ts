import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  resolveSignOffRequestSchema,
  signOffIdSchema,
  signOffListQuerySchema,
  type WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { RequirePermissions } from '../permissions/permissions.decorator.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { SignOffsService } from './sign-offs.service.js';

const permissionsGuard = new PermissionsGuard(new Reflector());

@Controller('sign-offs')
@UseGuards(WorkspaceContextGuard, permissionsGuard)
export class SignOffsController {
  constructor(private readonly signOffsService: SignOffsService) {}

  @Get()
  @RequirePermissions('signoffs.view')
  async listSignOffs(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Query() query: unknown,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedQuery = signOffListQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException('Invalid sign-off query');
    }

    return this.signOffsService.listSignOffs({
      workspaceId: workspaceContext.workspace.id,
      ...parsedQuery.data,
    });
  }

  @Post(':id/respond')
  @RequirePermissions('signoffs.respond')
  async respondToSignOff(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Param('id') signOffId: string,
    @Body() body: unknown,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedSignOffId = signOffIdSchema.safeParse(signOffId);
    if (!parsedSignOffId.success) {
      throw new BadRequestException('Invalid sign-off id');
    }

    const parsedBody = resolveSignOffRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new BadRequestException('Invalid sign-off response');
    }

    return this.signOffsService.requestResolution({
      workspaceId: workspaceContext.workspace.id,
      signOffId: parsedSignOffId.data,
      actorUserId: workspaceContext.membership.userId,
      action: parsedBody.data.action,
      reason: parsedBody.data.reason,
    });
  }

  @Post(':id/reminder')
  @RequirePermissions('signoffs.remind')
  async sendReminder(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Param('id') signOffId: string,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedSignOffId = signOffIdSchema.safeParse(signOffId);
    if (!parsedSignOffId.success) {
      throw new BadRequestException('Invalid sign-off id');
    }

    return this.signOffsService.sendManualReminder({
      workspaceId: workspaceContext.workspace.id,
      signOffId: parsedSignOffId.data,
      actorUserId: workspaceContext.membership.userId,
    });
  }
}
