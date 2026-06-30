import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SessionService } from './session.service.js';

function makeService() {
  const repository = {
    bootstrapFromInframodern: vi.fn().mockResolvedValue('82bf0afe-b730-4046-ac0b-30f74ce1db7a'),
    createSession: vi.fn().mockResolvedValue('3f43835d-7f3b-4b16-907b-d57db49832dd'),
    findCurrentUserBySessionId: vi.fn(),
    updateTokens: vi.fn().mockResolvedValue(undefined),
    revokeSession: vi.fn().mockResolvedValue(undefined),
  };
  const oauthClient = {
    buildAuthorizeUrl: vi.fn((state: string) => `http://frontend.test/authenticate?state=${state}`),
    exchangeCode: vi.fn().mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      scope: 'openid profile email',
    }),
    refresh: vi.fn().mockResolvedValue({
      access_token: 'rotated-access-token',
      refresh_token: 'rotated-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token_expires_in: 86400,
      scope: 'openid profile email',
    }),
    fetchUser: vi.fn().mockResolvedValue({
      id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      email: 'admin@example.com',
      name: 'Admin User',
      workspaces: [],
      adminWorkspaces: [],
    }),
  };
  const crypto = {
    encrypt: vi.fn(() => 'encrypted-token-payload'),
    decrypt: vi.fn(() => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      scope: 'openid profile email',
    })),
  };
  const user = {
    id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    email: 'admin@example.com',
    displayName: 'Admin User',
    phone: null,
    avatarUrl: null,
    activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    workspaces: [],
  };
  const service = new SessionService(repository as never, oauthClient as never, crypto as never, {
    sessionTtlSeconds: 28_800,
  });

  return { crypto, oauthClient, repository, service, user };
}

describe('SessionService', () => {
  it('creates a server-side session from a valid callback', async () => {
    const { crypto, repository, service } = makeService();

    await expect(service.handleCallback('code-1', 'stored-state', 'stored-state')).resolves.toEqual(
      {
        sessionId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      },
    );

    expect(repository.bootstrapFromInframodern).toHaveBeenCalled();
    expect(crypto.encrypt).toHaveBeenCalledWith({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      scope: 'openid profile email',
    });
    expect(repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        encryptedTokens: 'encrypted-token-payload',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
        expiresAt: expect.any(Date),
      }),
    );
  });

  it('rejects callback state mismatch', async () => {
    const { service } = makeService();

    await expect(service.handleCallback('code-1', 'stored-state', 'wrong-state')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects missing callback code', async () => {
    const { service } = makeService();

    await expect(service.handleCallback(undefined, 'stored-state', 'stored-state')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects missing sessions', async () => {
    const { repository, service } = makeService();
    repository.findCurrentUserBySessionId.mockResolvedValue(null);

    await expect(service.getCurrentUser('missing-session')).rejects.toThrow(UnauthorizedException);
  });

  it('refreshes tokens server-side and returns the current user', async () => {
    const { crypto, oauthClient, repository, service, user } = makeService();
    repository.findCurrentUserBySessionId.mockResolvedValue({
      encryptedTokens: 'encrypted-token-payload',
      user,
    });

    await expect(service.refresh('session-id')).resolves.toEqual(user);

    expect(crypto.decrypt).toHaveBeenCalledWith('encrypted-token-payload');
    expect(oauthClient.refresh).toHaveBeenCalledWith('refresh-token');
    expect(repository.updateTokens).toHaveBeenCalledWith(
      'session-id',
      expect.objectContaining({
        encryptedTokens: 'encrypted-token-payload',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      }),
    );
  });

  it('revokes sessions when logging out', async () => {
    const { repository, service } = makeService();

    await service.logout('session-id');

    expect(repository.revokeSession).toHaveBeenCalledWith('session-id');
  });
});
