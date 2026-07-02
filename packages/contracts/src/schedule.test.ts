import { describe, expect, it } from 'vitest';

import {
  moveForecastDateRequestSchema,
  replaceMilestoneDrawLinksRequestSchema,
  scheduleResponseSchema,
  selfCertifyBaselineRequestSchema,
} from './schedule.js';

describe('schedule contracts', () => {
  it('requires a client-visible reason when a forecast date moves', () => {
    expect(
      moveForecastDateRequestSchema.safeParse({
        forecastDate: '2026-09-01',
        reason: 'Steel delivery moved by supplier',
      }).success,
    ).toBe(true);

    expect(
      moveForecastDateRequestSchema.safeParse({
        forecastDate: '2026-09-01',
        reason: '   ',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate draw ids in milestone draw link replacement', () => {
    const drawItemId = '11111111-1111-4111-8111-111111111111';

    expect(
      replaceMilestoneDrawLinksRequestSchema.safeParse({
        drawItemIds: [drawItemId, drawItemId],
      }).success,
    ).toBe(false);
  });

  it('requires a reason for manual baseline self-certification', () => {
    expect(selfCertifyBaselineRequestSchema.safeParse({ reason: '' }).success).toBe(false);
    expect(
      selfCertifyBaselineRequestSchema.safeParse({
        reason: 'Client approval happened outside the portal',
      }).success,
    ).toBe(true);
  });

  it('serializes schedule responses with phases, milestones, baseline, moves, and draw links', () => {
    const parsed = scheduleResponseSchema.parse({
      projectId: '22222222-2222-4222-8222-222222222222',
      phases: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          projectId: '22222222-2222-4222-8222-222222222222',
          workspaceId: '44444444-4444-4444-8444-444444444444',
          name: 'Structure',
          startsOn: '2026-08-01',
          endsOn: '2026-08-31',
          displayOrder: 10,
          createdAt: '2026-07-02T09:00:00.000Z',
          updatedAt: '2026-07-02T09:00:00.000Z',
        },
      ],
      milestones: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          projectId: '22222222-2222-4222-8222-222222222222',
          workspaceId: '44444444-4444-4444-8444-444444444444',
          phaseId: '33333333-3333-4333-8333-333333333333',
          name: 'Slab complete',
          description: null,
          forecastDate: '2026-08-20',
          completedAt: null,
          completedByUserId: null,
          displayOrder: 10,
          drawItemIds: ['66666666-6666-4666-8666-666666666666'],
          createdAt: '2026-07-02T09:00:00.000Z',
          updatedAt: '2026-07-02T09:00:00.000Z',
        },
      ],
      baseline: null,
      forecastMoves: [],
    });

    expect(parsed.milestones[0]?.drawItemIds).toEqual(['66666666-6666-4666-8666-666666666666']);
  });
});
