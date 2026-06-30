import {
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';

import { SessionGuard } from '../session/session.guard.js';
import { WorkspaceContextService } from './workspace-context.service.js';
import type { WorkspaceScopedRequest } from './workspace-context.types.js';

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(
    @Inject(SessionGuard) private readonly sessionGuard: SessionGuard,
    @Inject(WorkspaceContextService)
    private readonly workspaceContextService: WorkspaceContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceScopedRequest>();
    if (!request.user) {
      await this.sessionGuard.canActivate(context);
    }

    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    request.workspaceContext = await this.workspaceContextService.resolveForRequest({
      sessionId: request.sessionId,
      user: request.user,
      requestedWorkspaceId: readWorkspaceHeader(request.headers?.['x-workspace-id']),
    });

    return true;
  }
}

function readWorkspaceHeader(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0];
}
