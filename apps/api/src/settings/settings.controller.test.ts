import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { REQUIRED_PERMISSIONS_METADATA } from '../permissions/permissions.decorator.js';
import { SettingsController } from './settings.controller.js';

const requiredPermissionsFor = (methodName: keyof SettingsController) =>
  Reflect.getMetadata(REQUIRED_PERMISSIONS_METADATA, SettingsController.prototype[methodName]);

describe('SettingsController', () => {
  it('uses settings permissions for defaults endpoints', () => {
    expect(requiredPermissionsFor('getDefaults')).toEqual(['settings.view']);
    expect(requiredPermissionsFor('updateDefaults')).toEqual(['settings.manage_defaults']);
  });
});
