import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CurrentSessionUser, WorkspaceAccess } from '@materiabill/contracts';

import {
  InframodernOAuthClient,
  InframodernOAuthTokenRequestError,
  InframodernOAuthUserRequestError,
} from './inframodern-oauth.client.js';
import { SessionCrypto } from './session.crypto.js';
import { NestSessionRepository } from './session.repository.js';
import type { OAuthTokenResponse, StoredOAuthTokens } from './session.types.js';

type ServiceConfig = {
  readonly sessionTtlSeconds: number;
};

type WorkspaceIntegrationAccess = Pick<WorkspaceAccess, 'appInstalled' | 'subscriptionActive'>;

const activeWorkspaceIntegrationAccess: WorkspaceIntegrationAccess = {
  appInstalled: true,
  subscriptionActive: true,
};

@Injectable()
export class SessionService {
  constructor(
    private readonly repository: NestSessionRepository,
    private readonly oauthClient: InframodernOAuthClient,
    private readonly crypto: SessionCrypto,
    private readonly config: ServiceConfig,
  ) {}

  buildLoginRedirect(state: string): string {
    return this.oauthClient.buildAuthorizeUrl(state);
  }

  async handleCallback(
    code: string | undefined,
    storedState: string | undefined,
    returnedState: string | undefined,
  ): Promise<{ sessionId: string }> {
    if (!storedState || !returnedState || storedState !== returnedState) {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (!code) {
      throw new BadRequestException('Missing authorization code');
    }

    const tokenResponse = await this.oauthClient.exchangeCode(code);
    const infraUser = await this.oauthClient.fetchUser(tokenResponse.access_token);
    const activeWorkspaceId = await this.repository.bootstrapFromInframodern(infraUser);
    const sessionId = await this.repository.createSession({
      userId: infraUser.id,
      activeWorkspaceId,
      encryptedTokens: this.crypto.encrypt(toStoredTokens(tokenResponse)),
      accessTokenExpiresAt: expiresAt(tokenResponse.expires_in),
      refreshTokenExpiresAt: expiresAt(tokenResponse.refresh_token_expires_in),
      expiresAt: new Date(Date.now() + this.config.sessionTtlSeconds * 1000),
    });

    return { sessionId };
  }

  async getCurrentUser(sessionId: string | undefined): Promise<CurrentSessionUser> {
    return (await this.#requireCurrentSession(requireSessionId(sessionId))).user;
  }

  async assertWorkspaceAccess(sessionId: string | undefined): Promise<WorkspaceIntegrationAccess> {
    const currentSessionId = requireSessionId(sessionId);
    const session = await this.#requireCurrentSession(currentSessionId);
    const storedTokens = this.crypto.decrypt(session.encryptedTokens);

    try {
      await this.oauthClient.fetchUser(storedTokens.accessToken);
      return activeWorkspaceIntegrationAccess;
    } catch (error) {
      if (!isExpiredAccessTokenError(error)) {
        throw mapWorkspaceAccessError(error);
      }
    }

    try {
      const tokenResponse = await this.oauthClient.refresh(storedTokens.refreshToken);
      const rotatedTokens = toStoredTokens(tokenResponse, storedTokens.refreshToken);
      await this.repository.updateTokens(currentSessionId, {
        encryptedTokens: this.crypto.encrypt(rotatedTokens),
        accessTokenExpiresAt: expiresAt(tokenResponse.expires_in),
        refreshTokenExpiresAt: expiresAt(tokenResponse.refresh_token_expires_in),
      });
      await this.oauthClient.fetchUser(rotatedTokens.accessToken);

      return activeWorkspaceIntegrationAccess;
    } catch (error) {
      throw mapWorkspaceAccessError(error);
    }
  }

  async refresh(sessionId: string | undefined): Promise<CurrentSessionUser> {
    const currentSessionId = requireSessionId(sessionId);
    const session = await this.#requireCurrentSession(currentSessionId);

    const storedTokens = this.crypto.decrypt(session.encryptedTokens);
    let tokenResponse: OAuthTokenResponse;
    try {
      tokenResponse = await this.oauthClient.refresh(storedTokens.refreshToken);
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        throw new UnauthorizedException('Session expired or invalid');
      }

      throw new ServiceUnavailableException('OAuth provider unavailable');
    }

    await this.repository.updateTokens(currentSessionId, {
      encryptedTokens: this.crypto.encrypt(
        toStoredTokens(tokenResponse, storedTokens.refreshToken),
      ),
      accessTokenExpiresAt: expiresAt(tokenResponse.expires_in),
      refreshTokenExpiresAt: expiresAt(tokenResponse.refresh_token_expires_in),
    });

    return session.user;
  }

  async logout(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.repository.revokeSession(sessionId);
  }

  async #requireCurrentSession(sessionId: string) {
    const session = await this.repository.findCurrentUserBySessionId(sessionId);
    if (!session) {
      throw new UnauthorizedException('Not authenticated');
    }

    return session;
  }
}

function requireSessionId(sessionId: string | undefined): string {
  if (!sessionId) {
    throw new UnauthorizedException('Not authenticated');
  }

  return sessionId;
}

function toStoredTokens(
  tokenResponse: OAuthTokenResponse,
  fallbackRefreshToken?: string,
): StoredOAuthTokens {
  const refreshToken = tokenResponse.refresh_token ?? fallbackRefreshToken;

  if (!refreshToken) {
    throw new ServiceUnavailableException('Invalid Inframodern token response');
  }

  return {
    accessToken: tokenResponse.access_token,
    refreshToken,
    tokenType: tokenResponse.token_type ?? 'Bearer',
    scope: tokenResponse.scope ?? null,
  };
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  return (
    error instanceof InframodernOAuthTokenRequestError &&
    (error.status === 400 || error.status === 401)
  );
}

function isExpiredAccessTokenError(error: unknown): boolean {
  return error instanceof InframodernOAuthUserRequestError && error.status === 401;
}

function mapWorkspaceAccessError(error: unknown): Error {
  if (
    error instanceof InframodernOAuthUserRequestError &&
    (error.status === 401 || error.status === 403)
  ) {
    return new ForbiddenException('Workspace access denied');
  }

  if (isInvalidRefreshTokenError(error)) {
    return new ForbiddenException('Workspace access denied');
  }

  return new ServiceUnavailableException('OAuth provider unavailable');
}

function expiresAt(seconds: number | null | undefined): Date | null {
  if (!seconds) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
}
