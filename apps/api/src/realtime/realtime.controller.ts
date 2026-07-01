import { Controller, Inject, Sse, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import type { Observable } from 'rxjs';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { RealtimeHub } from './realtime.hub.js';
import type { RealtimeSseMessage } from './realtime.types.js';

@Controller('realtime')
@UseGuards(WorkspaceContextGuard)
export class RealtimeController {
  constructor(@Inject(RealtimeHub) private readonly hub: RealtimeHub) {}

  @Sse('events')
  stream(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue | undefined,
  ): Observable<RealtimeSseMessage> {
    if (!workspaceContext) {
      throw new UnauthorizedException('Not authenticated');
    }

    return this.hub.subscribe(workspaceContext.workspace.id);
  }
}
