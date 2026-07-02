import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import { REQUIRED_PERMISSIONS_METADATA } from '../permissions/permissions.decorator.js';
import { ScheduleController } from './schedule.controller.js';

const requiredPermissionsFor = (methodName: keyof ScheduleController) =>
  Reflect.getMetadata(REQUIRED_PERMISSIONS_METADATA, ScheduleController.prototype[methodName]);

describe('ScheduleController', () => {
  it('declares schedule permissions per action', () => {
    expect(requiredPermissionsFor('getSchedule')).toEqual(['schedule.view']);
    expect(requiredPermissionsFor('createPhase')).toEqual(['schedule.manage']);
    expect(requiredPermissionsFor('proposeBaseline')).toEqual(['schedule.propose_baseline']);
    expect(requiredPermissionsFor('completeMilestone')).toEqual(['milestones.complete']);
  });
});
