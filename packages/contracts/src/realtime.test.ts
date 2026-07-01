import { describe, expect, it } from 'vitest';

import {
  realtimeEventEnvelopeSchema,
  realtimeEventTypeSchema,
  type RealtimeEventEnvelope,
} from './realtime.js';

const envelope: RealtimeEventEnvelope = {
  id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
  workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  type: 'pending_decisions.changed',
  payload: {
    projectId: '6fb54a70-0807-43b6-b5fe-6d446a673453',
    pendingCount: 2,
  },
  occurredAt: '2026-07-01T12:00:00.000Z',
};

describe('realtime contracts', () => {
  it('accepts known realtime event types', () => {
    expect(realtimeEventTypeSchema.parse('realtime.connected')).toBe('realtime.connected');
    expect(realtimeEventTypeSchema.parse('realtime.heartbeat')).toBe('realtime.heartbeat');
    expect(realtimeEventTypeSchema.parse('pending_decisions.changed')).toBe(
      'pending_decisions.changed',
    );
    expect(realtimeEventTypeSchema.parse('draws.settlement_bar.changed')).toBe(
      'draws.settlement_bar.changed',
    );
    expect(realtimeEventTypeSchema.parse('schedule.milestone.completed')).toBe(
      'schedule.milestone.completed',
    );
  });

  it('accepts a strict realtime event envelope', () => {
    expect(realtimeEventEnvelopeSchema.parse(envelope)).toEqual(envelope);
  });

  it('rejects unknown event types', () => {
    expect(() =>
      realtimeEventEnvelopeSchema.parse({
        ...envelope,
        type: 'payables.changed',
      }),
    ).toThrow();
  });

  it('rejects invalid workspace ids and timestamps', () => {
    expect(() =>
      realtimeEventEnvelopeSchema.parse({
        ...envelope,
        workspaceId: 'workspace-1',
        occurredAt: 'today',
      }),
    ).toThrow();
  });

  it('rejects extra envelope keys', () => {
    expect(() =>
      realtimeEventEnvelopeSchema.parse({
        ...envelope,
        channel: 'workspace',
      }),
    ).toThrow();
  });
});
