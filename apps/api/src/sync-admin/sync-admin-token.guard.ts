import { timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { getSyncAdminRuntimeConfig } from '@materiabill/config';

type HeaderRequest = {
  readonly headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class SyncAdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { syncAdminToken } = getSyncAdminRuntimeConfig(process.env);

    if (!syncAdminToken) {
      throw new ServiceUnavailableException('Sync admin endpoints are not configured');
    }

    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const header = request.headers['x-sync-admin-token'];
    const token = Array.isArray(header) ? header[0] : header;

    if (!token || !tokensMatch(token, syncAdminToken)) {
      throw new UnauthorizedException('Invalid sync admin token');
    }

    return true;
  }
}

function tokensMatch(token: string, expectedToken: string): boolean {
  if (Buffer.byteLength(token) !== Buffer.byteLength(expectedToken)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}
