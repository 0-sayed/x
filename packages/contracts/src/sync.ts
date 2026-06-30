import { z } from 'zod';

export const syncResourceSchema = z.enum(['users', 'brands', 'locations', 'exchange-rates']);

export const syncEnvelopeSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).min(1),
  correlationId: z.string().trim().min(1),
  jobId: z.string().trim().min(1).optional(),
  operationId: z.string().trim().min(1).optional(),
  targetApp: z.string().trim().min(1).optional(),
});

export const syncFailureListItemSchema = z.object({
  id: z.uuid(),
  eventId: z.string().trim().min(1),
  resource: syncResourceSchema.or(z.literal('unknown')),
  correlationId: z.string().trim().min(1),
  operationId: z.string().nullable(),
  jobId: z.string().nullable(),
  retryCount: z.number().int().nonnegative(),
  errorMessage: z.string(),
  failedAt: z.string(),
});

export const syncRetryResponseSchema = z.object({
  status: z.literal('queued'),
  failureId: z.string(),
});

export const syncPullRequestSchema = z.object({
  resources: z.array(syncResourceSchema).min(1).optional(),
});

export const syncPullResponseSchema = z.object({
  status: z.literal('queued'),
  resources: z.array(syncResourceSchema),
  publishedMessages: z.number().int().nonnegative(),
});

export type SyncResource = z.infer<typeof syncResourceSchema>;
export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;
export type SyncFailureListItem = z.infer<typeof syncFailureListItemSchema>;
export type SyncRetryResponse = z.infer<typeof syncRetryResponseSchema>;
export type SyncPullRequest = z.infer<typeof syncPullRequestSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
