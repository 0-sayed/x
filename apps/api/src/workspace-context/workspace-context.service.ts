import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  switchWorkspaceRequestSchema,
  type CurrentSessionUser,
  type WorkspaceContext,
  type WorkspaceSwitcherResponse,
} from '@materiabill/contracts';

import type { WorkspaceMembershipRecord } from './workspace-context.repository.js';
import { WorkspaceContextRepository } from './workspace-context.repository.js';

type ResolveWorkspaceInput = {
  readonly user: CurrentSessionUser;
  readonly requestedWorkspaceId: string | undefined;
};

type SwitchWorkspaceInput = {
  readonly sessionId: string;
  readonly user: CurrentSessionUser;
  readonly workspaceId: string;
};

@Injectable()
export class WorkspaceContextService {
  constructor(private readonly repository: WorkspaceContextRepository) {}

  async resolveForRequest(input: ResolveWorkspaceInput): Promise<WorkspaceContext> {
    const workspaceId = this.#resolveWorkspaceId(input);
    const membership = await this.repository.findMembershipContext(input.user.id, workspaceId);

    if (!membership) {
      throw new ForbiddenException('Workspace access denied');
    }

    return toWorkspaceContext(membership);
  }

  buildSwitcherResponse(
    user: CurrentSessionUser,
    activeWorkspaceId = user.activeWorkspaceId,
  ): WorkspaceSwitcherResponse {
    return {
      activeWorkspaceId,
      workspaces: user.workspaces,
    };
  }

  async switchActiveWorkspace(input: SwitchWorkspaceInput): Promise<WorkspaceSwitcherResponse> {
    const parsedWorkspaceId = this.#parseWorkspaceId(input.workspaceId);
    const membership = await this.repository.findMembershipContext(
      input.user.id,
      parsedWorkspaceId,
    );

    if (!membership) {
      throw new ForbiddenException('Workspace access denied');
    }

    const wasUpdated = await this.repository.updateActiveWorkspace(
      input.sessionId,
      input.user.id,
      parsedWorkspaceId,
    );

    if (!wasUpdated) {
      throw new UnauthorizedException('Not authenticated');
    }

    return this.buildSwitcherResponse(input.user, parsedWorkspaceId);
  }

  #resolveWorkspaceId(input: ResolveWorkspaceInput): string {
    if (input.requestedWorkspaceId) {
      return this.#parseWorkspaceId(input.requestedWorkspaceId);
    }

    const workspaceId = input.user.activeWorkspaceId ?? input.user.workspaces[0]?.id;

    if (!workspaceId) {
      throw new ForbiddenException('Workspace access denied');
    }

    return this.#parseWorkspaceId(workspaceId);
  }

  #parseWorkspaceId(workspaceId: string): string {
    const result = switchWorkspaceRequestSchema.safeParse({ workspaceId });

    if (!result.success) {
      throw new BadRequestException('Invalid workspace id');
    }

    return result.data.workspaceId;
  }
}

function toWorkspaceContext(record: WorkspaceMembershipRecord): WorkspaceContext {
  return {
    workspace: {
      id: record.workspaceId,
      name: record.workspaceName,
      slug: record.workspaceSlug,
      paymentCurrency: record.paymentCurrency,
    },
    membership: {
      userId: record.userId,
      roleKey: record.roleKey,
      permissions: [...record.permissions],
      isAdmin: record.isAdmin,
    },
    access: {
      appInstalled: true,
      subscriptionActive: true,
      membershipActive: true,
    },
  };
}
