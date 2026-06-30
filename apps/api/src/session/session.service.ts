import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CurrentSessionUser } from '@materiabill/contracts';

import { InframodernOAuthClient } from './inframodern-oauth.client.js';
import { SessionCrypto } from './session.crypto.js';
import { NestSessionRepository } from './session.repository.js';
import type { OAuthTokenResponse, StoredOAuthTokens } from './session.types.js';

type ServiceConfig = {
  readonly sessionTtlSeconds: number;
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
    if (!sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const session = await this.repository.findCurrentUserBySessionId(sessionId);
    if (!session) {
      throw new UnauthorizedException('Not authenticated');
    }

    return session.user;
  }

  async refresh(sessionId: string | undefined): Promise<CurrentSessionUser> {
    if (!sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const session = await this.repository.findCurrentUserBySessionId(sessionId);
    if (!session) {
      throw new UnauthorizedException('Not authenticated');
    }

    const storedTokens = this.crypto.decrypt(session.encryptedTokens);
    let tokenResponse: OAuthTokenResponse;
    try {
      tokenResponse = await this.oauthClient.refresh(storedTokens.refreshToken);
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }

    await this.repository.updateTokens(sessionId, {
      encryptedTokens: this.crypto.encrypt(toStoredTokens(tokenResponse)),
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
}

function toStoredTokens(tokenResponse: OAuthTokenResponse): StoredOAuthTokens {
  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type ?? 'Bearer',
    scope: tokenResponse.scope ?? null,
  };
}

function expiresAt(seconds: number | null | undefined): Date | null {
  if (!seconds) {
    return null;
  }

  return new Date(Date.now() + seconds * 1000);
}
