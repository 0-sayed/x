import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { REQUIRED_PERMISSIONS_METADATA, RequirePermissions } from './permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';

function createContext(permissions: readonly string[]) {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        workspaceContext: {
          membership: {
            permissions,
          },
        },
      }),
    }),
  };
}

describe('PermissionsGuard', () => {
  it('stores required permission metadata', () => {
    class Controller {
      @RequirePermissions('manage_roles')
      handler(): null {
        return null;
      }
    }

    const handler = Object.getOwnPropertyDescriptor(Controller.prototype, 'handler')?.value;

    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_METADATA, handler)).toEqual(['manage_roles']);
  });

  it('allows requests that include every required permission', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['roles.view', 'manage_roles']),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(createContext(['roles.view', 'manage_roles']) as never)).toBe(true);
  });

  it('rejects requests missing a required permission', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['manage_roles']),
    };
    const guard = new PermissionsGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(createContext(['roles.view']) as never)).toThrow(
      ForbiddenException,
    );
  });
});
