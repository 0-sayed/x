import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { getSessionRuntimeConfig } from '@materiabill/config';
import type { CurrentSessionUser } from '@materiabill/contracts';
import type { CookieOptions, Response } from 'express';
import { randomBytes } from 'node:crypto';

import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

type SignedCookieRequest = {
  readonly signedCookies?: Record<string, string | undefined>;
  user?: CurrentSessionUser;
};

type CookieConfig = {
  readonly adminUrl: string;
  readonly cookieName: string;
  readonly oauthStateCookieName: string;
  readonly sessionTtlSeconds: number;
  readonly oauthStateTtlSeconds: number;
  readonly secure: boolean;
};

@Controller()
export class SessionController {
  readonly #cookieConfig: CookieConfig;

  constructor(@Inject(SessionService) private readonly sessionService: SessionService) {
    const config = getSessionRuntimeConfig(process.env);

    this.#cookieConfig = {
      adminUrl: config.adminUrl,
      cookieName: config.cookieName,
      oauthStateCookieName: config.oauthStateCookieName,
      sessionTtlSeconds: config.sessionTtlSeconds,
      oauthStateTtlSeconds: config.oauthStateTtlSeconds,
      secure: config.cookieSecure,
    };
  }

  @Get('auth/login')
  login(@Res() response: Response): void {
    const state = randomBytes(32).toString('base64url');

    response.cookie(
      this.#cookieConfig.oauthStateCookieName,
      state,
      this.#cookieOptions(this.#cookieConfig.oauthStateTtlSeconds),
    );
    response.redirect(this.sessionService.buildLoginRedirect(state));
  }

  @Get('auth/callback')
  async callback(
    @Req() request: SignedCookieRequest,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ): Promise<void> {
    const result = await this.sessionService.handleCallback(
      code,
      request.signedCookies?.[this.#cookieConfig.oauthStateCookieName],
      state,
    );

    response.clearCookie(this.#cookieConfig.oauthStateCookieName, this.#clearCookieOptions());
    response.cookie(
      this.#cookieConfig.cookieName,
      result.sessionId,
      this.#cookieOptions(this.#cookieConfig.sessionTtlSeconds),
    );
    response.redirect(this.#cookieConfig.adminUrl);
  }

  @Get('user')
  @UseGuards(SessionGuard)
  user(@Req() request: SignedCookieRequest): CurrentSessionUser {
    if (!request.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    return request.user;
  }

  @Post('auth/refresh')
  refresh(@Req() request: SignedCookieRequest): Promise<CurrentSessionUser> {
    return this.sessionService.refresh(request.signedCookies?.[this.#cookieConfig.cookieName]);
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(
    @Req() request: SignedCookieRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessionService.logout(request.signedCookies?.[this.#cookieConfig.cookieName]);
    response.clearCookie(this.#cookieConfig.cookieName, this.#clearCookieOptions());
    response.clearCookie(this.#cookieConfig.oauthStateCookieName, this.#clearCookieOptions());
  }

  #cookieOptions(maxAgeSeconds: number): CookieOptions {
    return {
      httpOnly: true,
      maxAge: maxAgeSeconds * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.#cookieConfig.secure,
      signed: true,
    };
  }

  #clearCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: this.#cookieConfig.secure,
      signed: true,
    };
  }
}
