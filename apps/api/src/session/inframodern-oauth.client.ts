import type {
  InframodernOAuthClientConfig,
  InframodernOAuthUser,
  OAuthTokenResponse,
} from './session.types.js';

export class InframodernOAuthTokenRequestError extends Error {
  constructor(readonly status: number) {
    super(`Inframodern token request failed with status ${String(status)}`);
    this.name = 'InframodernOAuthTokenRequestError';
  }
}

export class InframodernOAuthUserRequestError extends Error {
  constructor(readonly status: number) {
    super(`Inframodern user request failed with status ${String(status)}`);
    this.name = 'InframodernOAuthUserRequestError';
  }
}

export class InframodernOAuthClient {
  readonly #config: InframodernOAuthClientConfig;
  readonly #fetch: typeof fetch;

  constructor(config: InframodernOAuthClientConfig, fetchFn: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
  }

  buildAuthorizeUrl(state: string): string {
    const url = new URL('/authenticate', this.#config.inframodernFrontendUrl);

    url.search = new URLSearchParams({
      client_id: this.#config.oauthClient.clientId,
      redirect_uri: this.#config.oauthClient.callbackUrl,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    }).toString();

    return url.toString();
  }

  exchangeCode(code: string): Promise<OAuthTokenResponse> {
    return this.#postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.#config.oauthClient.clientId,
        client_secret: this.#config.oauthClient.clientSecret,
        redirect_uri: this.#config.oauthClient.callbackUrl,
      }),
    );
  }

  refresh(refreshToken: string): Promise<OAuthTokenResponse> {
    return this.#postToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.#config.oauthClient.clientId,
        client_secret: this.#config.oauthClient.clientSecret,
      }),
    );
  }

  async fetchUser(accessToken: string): Promise<InframodernOAuthUser> {
    const response = await this.#fetch(
      new URL('/oauth/user', this.#config.inframodernUrl).toString(),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new InframodernOAuthUserRequestError(response.status);
    }

    return parseInframodernOAuthUser(await response.json());
  }

  async #postToken(params: URLSearchParams): Promise<OAuthTokenResponse> {
    const response = await this.#fetch(
      new URL('/oauth/token', this.#config.inframodernUrl).toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      throw new InframodernOAuthTokenRequestError(response.status);
    }

    return parseOAuthTokenResponse(await response.json());
  }
}

function parseOAuthTokenResponse(value: unknown): OAuthTokenResponse {
  if (!isRecord(value) || !isString(value.access_token)) {
    throw new Error('Invalid Inframodern token response');
  }

  if (
    !isOptionalString(value.refresh_token) ||
    !isOptionalString(value.token_type) ||
    !isOptionalString(value.scope) ||
    !isOptionalNumber(value.expires_in) ||
    !isOptionalNumber(value.refresh_token_expires_in)
  ) {
    throw new Error('Invalid Inframodern token response');
  }

  return value as OAuthTokenResponse;
}

function parseInframodernOAuthUser(value: unknown): InframodernOAuthUser {
  if (!isRecord(value) || !isString(value.id) || !isString(value.email)) {
    throw new Error('Invalid Inframodern user response');
  }

  if (
    !isOptionalString(value.name) ||
    !isOptionalString(value.displayName) ||
    !isOptionalString(value.phone) ||
    !isOptionalString(value.avatarUrl) ||
    !isOptionalString(value.locale) ||
    !isOptionalWorkspaceMemberships(value.workspaces) ||
    !isOptionalWorkspaceSummaries(value.adminWorkspaces)
  ) {
    throw new Error('Invalid Inframodern user response');
  }

  return value as InframodernOAuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || isString(value);
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'number';
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((entry) => isString(entry)))
  );
}

function isOptionalWorkspaceMemberships(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((entry) => isWorkspaceMembership(entry)))
  );
}

function isWorkspaceMembership(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalWorkspaceSummary(value.workspace) &&
    isOptionalRole(value.role) &&
    isOptionalStringArray(value.permissions)
  );
}

function isOptionalRole(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  return (
    isRecord(value) &&
    (value.localizedName === undefined ||
      value.localizedName === null ||
      (Array.isArray(value.localizedName) &&
        value.localizedName.every(
          (entry) => isRecord(entry) && isString(entry.locale) && isString(entry.value),
        )))
  );
}

function isOptionalWorkspaceSummaries(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((entry) => isWorkspaceSummary(entry)))
  );
}

function isOptionalWorkspaceSummary(value: unknown): boolean {
  return value === undefined || value === null || isWorkspaceSummary(value);
}

function isWorkspaceSummary(value: unknown): boolean {
  return (
    isRecord(value) && isString(value.id) && isOptionalString(value.code) && isString(value.name)
  );
}
