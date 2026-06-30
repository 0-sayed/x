import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { REQUIRED_PERMISSIONS_METADATA } from './permissions.decorator.js';
import { PermissionsController } from './permissions.controller.js';

const requiredPermissionsFor = (methodName: keyof PermissionsController) =>
  Reflect.getMetadata(REQUIRED_PERMISSIONS_METADATA, PermissionsController.prototype[methodName]);

describe('PermissionsController', () => {
  it('uses granular permissions for RBAC mutation endpoints', () => {
    expect(requiredPermissionsFor('createRole')).toEqual(['roles.create']);
    expect(requiredPermissionsFor('updateRole')).toEqual(['roles.edit']);
    expect(requiredPermissionsFor('cloneRole')).toEqual(['roles.create']);
    expect(requiredPermissionsFor('replaceUserRoleAssignments')).toEqual([
      'user_role_assignments.manage',
    ]);
  });
});
