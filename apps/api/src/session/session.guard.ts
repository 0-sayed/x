import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { getSessionRuntimeConfig } from '@materiabill/config';

import { SessionService } from './session.service.js';
import type { AuthenticatedRequestUser } from './session.types.js';

type SignedCookieRequest = {
  readonly signedCookies?: Record<string, string | undefined>;
  user?: AuthenticatedRequestUser;
};

@Injectable()
export class SessionGuard implements CanActivate {
  readonly #cookieName = getSessionRuntimeConfig(process.env).cookieName;

  constructor(@Inject(SessionService) private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SignedCookieRequest>();
    request.user = await this.sessionService.getCurrentUser(
      request.signedCookies?.[this.#cookieName],
    );

    return true;
  }
}
