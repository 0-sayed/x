import { z } from 'zod';

export const realtimeEventTypeSchema = z.enum([
  'realtime.connected',
  'realtime.heartbeat',
  'pending_decisions.changed',
  'draws.settlement_bar.changed',
  'schedule.milestone.completed',
  'schedule.forecast.moved',
  'schedule.baseline.changed',
  'notifications.changed',
]);

export const realtimeEventPayloadSchema = z.record(z.string(), z.unknown());

export const realtimeEventEnvelopeSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    type: realtimeEventTypeSchema,
    payload: realtimeEventPayloadSchema,
    occurredAt: z.iso.datetime(),
  })
  .strict();

export type RealtimeEventType = z.infer<typeof realtimeEventTypeSchema>;
export type RealtimeEventPayload = z.infer<typeof realtimeEventPayloadSchema>;
export type RealtimeEventEnvelope = z.infer<typeof realtimeEventEnvelopeSchema>;
