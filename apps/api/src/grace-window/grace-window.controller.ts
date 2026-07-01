import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  pendingDecisionIdSchema,
  pendingDecisionListQuerySchema,
  type WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { GraceWindowService } from './grace-window.service.js';

@Controller('pending-decisions')
@UseGuards(WorkspaceContextGuard)
export class GraceWindowController {
  constructor(private readonly graceWindowService: GraceWindowService) {}

  @Get()
  async listPendingDecisions(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Query() query: unknown,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedQuery = pendingDecisionListQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException('Invalid pending decision query');
    }

    return this.graceWindowService.listActivePendingDecisions({
      workspaceId: workspaceContext.workspace.id,
      projectId: parsedQuery.data.projectId,
      limit: parsedQuery.data.limit,
    });
  }

  @Post(':id/undo')
  async undoPendingDecision(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Param('id') decisionId: string,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    const parsedDecisionId = pendingDecisionIdSchema.safeParse(decisionId);
    if (!parsedDecisionId.success) {
      throw new BadRequestException('Invalid pending decision id');
    }

    return this.graceWindowService.undoPendingDecision({
      workspaceContext,
      decisionId: parsedDecisionId.data,
    });
  }
}
