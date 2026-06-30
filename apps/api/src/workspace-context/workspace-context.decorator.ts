import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';

import type { WorkspaceScopedRequest } from './workspace-context.types.js';

export const WorkspaceContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): WorkspaceContextValue | undefined =>
    context.switchToHttp().getRequest<WorkspaceScopedRequest>().workspaceContext,
);
