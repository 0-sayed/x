import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionKey } from '@materiabill/contracts';

import type { WorkspaceScopedRequest } from '../workspace-context/workspace-context.types.js';
import { REQUIRED_PERMISSIONS_METADATA } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<readonly PermissionKey[] | undefined>(
        REQUIRED_PERMISSIONS_METADATA,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<WorkspaceScopedRequest>();
    const grantedPermissions = new Set(request.workspaceContext?.membership.permissions ?? []);

    const missingPermission = requiredPermissions.find(
      (permission) => !grantedPermissions.has(permission),
    );
    if (missingPermission) {
      throw new ForbiddenException('Permission denied');
    }

    return true;
  }
}
