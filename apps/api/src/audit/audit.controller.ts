import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  auditEventQuerySchema,
  type WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { AuditService } from './audit.service.js';

@Controller('audit-events')
@UseGuards(WorkspaceContextGuard)
export class AuditController {
  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  @Get()
  listEvents(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
    @Query() query: unknown,
  ) {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }
    if (
      !workspaceContext.membership.isAdmin &&
      !workspaceContext.membership.permissions.includes('audit.view')
    ) {
      throw new ForbiddenException('Missing audit.view permission');
    }

    const parsedQuery = auditEventQuerySchema.safeParse(query);
    if (!parsedQuery.success) {
      throw new BadRequestException('Invalid audit query');
    }

    return this.auditService.listEvents({
      workspaceId: workspaceContext.workspace.id,
      ...parsedQuery.data,
    });
  }
}
