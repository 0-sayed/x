import type { CurrentSessionUser, WorkspaceContext } from '@materiabill/contracts';

export type WorkspaceScopedRequest = {
  readonly headers?: Record<string, string | readonly string[] | undefined>;
  readonly signedCookies?: Record<string, string | undefined>;
  sessionId?: string;
  user?: CurrentSessionUser;
  workspaceContext?: WorkspaceContext;
};
