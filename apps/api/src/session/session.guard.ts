import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { getSessionRuntimeConfig } from '@materiabill/config';

import { SessionService } from './session.service.js';
import type { AuthenticatedRequestUser } from './session.types.js';

type SignedCookieRequest = {
  readonly signedCookies?: Record<string, string | undefined>;
  sessionId?: string;
  user?: AuthenticatedRequestUser;
};

@Injectable()
export class SessionGuard implements CanActivate {
  readonly #cookieName = getSessionRuntimeConfig(process.env).cookieName;

  constructor(@Inject(SessionService) private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SignedCookieRequest>();
    if (request.user) {
      return true;
    }

    const sessionId = request.signedCookies?.[this.#cookieName];
    request.sessionId = sessionId;
    request.user = await this.sessionService.getCurrentUser(sessionId);

    return true;
  }
}
