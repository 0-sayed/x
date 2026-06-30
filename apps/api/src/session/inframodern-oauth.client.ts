import type {
  InframodernOAuthClientConfig,
  InframodernOAuthUser,
  OAuthTokenResponse,
} from './session.types.js';

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
      throw new Error(`Inframodern user request failed with status ${String(response.status)}`);
    }

    return (await response.json()) as InframodernOAuthUser;
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
      throw new Error(`Inframodern token request failed with status ${String(response.status)}`);
    }

    return (await response.json()) as OAuthTokenResponse;
  }
}
