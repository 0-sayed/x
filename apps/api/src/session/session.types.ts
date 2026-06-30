import type { SessionRuntimeConfig } from '@materiabill/config';
import type { CurrentSessionUser } from '@materiabill/contracts';

export type StoredOAuthTokens = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly scope: string | null;
};

export type InframodernOAuthClientConfig = Pick<
  SessionRuntimeConfig,
  'inframodernUrl' | 'inframodernFrontendUrl' | 'oauthClient'
>;

type InframodernLocalizedName = {
  readonly locale: string;
  readonly value: string;
};

type InframodernWorkspaceRole = {
  readonly localizedName?: readonly InframodernLocalizedName[] | null;
};

type InframodernWorkspaceSummary = {
  readonly id: string;
  readonly code?: string | null;
  readonly name: string;
};

type InframodernWorkspaceMembership = {
  readonly workspace?: InframodernWorkspaceSummary | null;
  readonly role?: InframodernWorkspaceRole | null;
  readonly permissions?: readonly string[] | null;
};

export type InframodernOAuthUser = {
  readonly id: string;
  readonly email: string;
  readonly name?: string | null;
  readonly displayName?: string | null;
  readonly phone?: string | null;
  readonly avatarUrl?: string | null;
  readonly locale?: string | null;
  readonly workspaces?: readonly InframodernWorkspaceMembership[] | null;
  readonly adminWorkspaces?: readonly InframodernWorkspaceSummary[] | null;
};

export type OAuthTokenResponse = {
  readonly access_token: string;
  readonly refresh_token?: string | null;
  readonly token_type?: string | null;
  readonly scope?: string | null;
  readonly expires_in?: number | null;
  readonly refresh_token_expires_in?: number | null;
};

export type AuthenticatedRequestUser = CurrentSessionUser;
