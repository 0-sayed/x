import { z } from 'zod';

const payloadSchema = z.record(z.string(), z.unknown());

export const pendingDecisionIdSchema = z.uuid();
export const pendingDecisionStatusSchema = z.enum(['pending', 'undone', 'committed']);
export const decisionAudienceSchema = z.enum(['org', 'participants', 'client']);

export const createPendingDecisionInputSchema = z
  .object({
    workspaceId: z.uuid(),
    actorUserId: z.uuid().nullable(),
    projectId: z.uuid().nullable().optional(),
    audience: decisionAudienceSchema,
    decisionType: z.string().trim().min(1).max(120),
    recordType: z.string().trim().min(1).max(80),
    recordId: z.string().trim().min(1).nullable().optional(),
    summaryLabel: z.string().trim().min(1).max(200),
    commitPayload: payloadSchema.optional(),
    undoPayload: payloadSchema.optional(),
    graceWindowMinutes: z.coerce.number().int().min(1).max(1440).default(10),
    requestedAt: z.iso.datetime().optional(),
  })
  .strict();

export const pendingDecisionSchema = z
  .object({
    id: pendingDecisionIdSchema,
    workspaceId: z.uuid(),
    projectId: z.uuid().nullable(),
    requestedByUserId: z.uuid().nullable(),
    status: pendingDecisionStatusSchema,
    audience: decisionAudienceSchema,
    decisionType: z.string().trim().min(1),
    recordType: z.string().trim().min(1),
    recordId: z.string().trim().min(1).nullable(),
    summaryLabel: z.string().trim().min(1),
    commitPayload: payloadSchema,
    undoPayload: payloadSchema,
    requestedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    remainingSeconds: z.number().int().min(0),
  })
  .strict();

export const pendingDecisionListQuerySchema = z
  .object({
    projectId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const pendingDecisionListResponseSchema = z
  .object({
    decisions: z.array(pendingDecisionSchema),
  })
  .strict();

export const undoPendingDecisionResponseSchema = z
  .object({
    decision: pendingDecisionSchema,
  })
  .strict();

export type PendingDecisionId = z.infer<typeof pendingDecisionIdSchema>;
export type PendingDecisionStatus = z.infer<typeof pendingDecisionStatusSchema>;
export type DecisionAudience = z.infer<typeof decisionAudienceSchema>;
export type CreatePendingDecisionInput = z.input<typeof createPendingDecisionInputSchema>;
export type ParsedCreatePendingDecisionInput = z.infer<typeof createPendingDecisionInputSchema>;
export type PendingDecision = z.infer<typeof pendingDecisionSchema>;
export type PendingDecisionListQuery = z.infer<typeof pendingDecisionListQuerySchema>;
export type PendingDecisionListResponse = z.infer<typeof pendingDecisionListResponseSchema>;
export type UndoPendingDecisionResponse = z.infer<typeof undoPendingDecisionResponseSchema>;
