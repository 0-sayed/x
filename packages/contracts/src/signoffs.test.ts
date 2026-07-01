import { describe, expect, it } from 'vitest';

import {
  createSignOffInputSchema,
  resolveSignOffRequestSchema,
  signOffListQuerySchema,
  signOffSchema,
} from './signoffs.js';

const baseSignOff = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  projectId: '33333333-3333-4333-8333-333333333333',
  subjectType: 'timeline_baseline',
  subjectId: 'baseline-1',
  title: 'Approve timeline baseline',
  summary: 'Client approval locks the initial baseline date.',
  assignedAudience: 'client',
  requiredAction: 'approve',
  status: 'pending',
  requestedByUserId: '44444444-4444-4444-8444-444444444444',
  resolvedByUserId: null,
  resolutionReason: null,
  resolutionDecisionId: null,
  lastReminderAt: null,
  reminderCount: 0,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  resolvedAt: null,
} as const;

describe('sign-off contracts', () => {
  it('parses a pending sign-off record', () => {
    expect(signOffSchema.parse(baseSignOff)).toEqual(baseSignOff);
  });

  it('requires a reason when rejecting a sign-off', () => {
    expect(() => resolveSignOffRequestSchema.parse({ action: 'reject' })).toThrow();
    expect(
      resolveSignOffRequestSchema.parse({ action: 'reject', reason: 'Scope changed' }),
    ).toEqual({
      action: 'reject',
      reason: 'Scope changed',
    });
  });

  it('accepts approve and sign without a reason', () => {
    expect(resolveSignOffRequestSchema.parse({ action: 'approve' })).toEqual({ action: 'approve' });
    expect(resolveSignOffRequestSchema.parse({ action: 'sign' })).toEqual({ action: 'sign' });
  });

  it('defaults list query limit and validates filters', () => {
    expect(signOffListQuerySchema.parse({ status: 'pending' })).toEqual({
      status: 'pending',
      limit: 50,
    });
  });

  it('validates create input for a workspace-scoped project sign-off', () => {
    expect(
      createSignOffInputSchema.parse({
        workspaceId: baseSignOff.workspaceId,
        projectId: baseSignOff.projectId,
        subjectType: baseSignOff.subjectType,
        subjectId: baseSignOff.subjectId,
        title: baseSignOff.title,
        summary: baseSignOff.summary,
        assignedAudience: baseSignOff.assignedAudience,
        requiredAction: baseSignOff.requiredAction,
        requestedByUserId: baseSignOff.requestedByUserId,
      }),
    ).toMatchObject({
      workspaceId: baseSignOff.workspaceId,
      projectId: baseSignOff.projectId,
      assignedAudience: 'client',
      requiredAction: 'approve',
    });
  });
});
