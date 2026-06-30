import { afterEach, describe, expect, it, vi } from 'vitest';

import { InframodernOAuthClient } from './inframodern-oauth.client.js';

describe('InframodernOAuthClient', () => {
  const config = {
    inframodernUrl: 'https://api.inframodern.test',
    inframodernFrontendUrl: 'https://frontend.inframodern.test',
    oauthClient: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      callbackUrl: 'https://api.materiabill.test/auth/callback',
    },
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds the authorize URL against the frontend authenticate route', () => {
    const client = new InframodernOAuthClient(config);

    const url = client.buildAuthorizeUrl('state-123');

    expect(url).toBe(
      'https://frontend.inframodern.test/authenticate?client_id=client-id&redirect_uri=https%3A%2F%2Fapi.materiabill.test%2Fauth%2Fcallback&response_type=code&scope=openid+profile+email&state=state-123',
    );
  });

  it('posts the authorization code exchange to the API token endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        scope: 'openid profile email',
        expires_in: 3600,
        refresh_token_expires_in: 7200,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new InframodernOAuthClient(config);

    const result = await client.exchangeCode('auth-code');

    expect(fetchMock).toHaveBeenCalledWith('https://api.inframodern.test/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=auth-code&client_id=client-id&client_secret=client-secret&redirect_uri=https%3A%2F%2Fapi.materiabill.test%2Fauth%2Fcallback',
    });
    expect(result).toMatchObject({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      scope: 'openid profile email',
      expires_in: 3600,
      refresh_token_expires_in: 7200,
    });
  });

  it('posts refresh token requests to the API token endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'next-access-token',
        refresh_token: 'next-refresh-token',
        token_type: 'Bearer',
        scope: null,
        expires_in: 1800,
        refresh_token_expires_in: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new InframodernOAuthClient(config);

    const result = await client.refresh('stored-refresh-token');

    expect(fetchMock).toHaveBeenCalledWith('https://api.inframodern.test/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=stored-refresh-token&client_id=client-id&client_secret=client-secret',
    });
    expect(result).toMatchObject({
      access_token: 'next-access-token',
      refresh_token: 'next-refresh-token',
      token_type: 'Bearer',
      scope: null,
      expires_in: 1800,
      refresh_token_expires_in: null,
    });
  });

  it('fetches the OAuth user from the API user endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
        phone: null,
        avatarUrl: null,
        locale: 'en',
        workspaces: [
          {
            workspace: {
              id: 'workspace-1',
              code: 'workspace-1',
              name: 'Workspace 1',
            },
            permissions: ['workspace.view'],
          },
        ],
        adminWorkspaces: [{ id: 'workspace-1', code: 'workspace-1', name: 'Workspace 1' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new InframodernOAuthClient(config);

    const user = await client.fetchUser('access-token');

    expect(fetchMock).toHaveBeenCalledWith('https://api.inframodern.test/oauth/user', {
      headers: { Authorization: 'Bearer access-token' },
    });
    expect(user).toMatchObject({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      locale: 'en',
    });
  });

  it('rejects malformed token responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'access-token',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new InframodernOAuthClient(config);

    await expect(client.exchangeCode('auth-code')).rejects.toThrow(
      'Invalid Inframodern token response',
    );
  });

  it('rejects malformed user responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'user-1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new InframodernOAuthClient(config);

    await expect(client.fetchUser('access-token')).rejects.toThrow(
      'Invalid Inframodern user response',
    );
  });
});
