import { z } from 'zod';

const auditMetadataSchema = z.record(z.string(), z.unknown());

export const auditAudienceSchema = z.enum(['internal', 'client']);

export const auditEventSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    actorUserId: z.uuid().nullable(),
    audience: auditAudienceSchema,
    action: z.string().trim().min(1),
    resourceType: z.string().trim().min(1),
    resourceId: z.string().trim().min(1).nullable(),
    metadata: auditMetadataSchema,
    occurredAt: z.iso.datetime(),
  })
  .strict();

export const createAuditEventInputSchema = z
  .object({
    workspaceId: z.uuid(),
    actorUserId: z.uuid().nullable(),
    audience: auditAudienceSchema,
    action: z.string().trim().min(1),
    resourceType: z.string().trim().min(1),
    resourceId: z.string().trim().min(1).nullable().optional(),
    metadata: auditMetadataSchema.optional(),
  })
  .strict();

export const auditEventQuerySchema = z
  .object({
    audience: auditAudienceSchema.optional(),
    before: z.iso.datetime().optional(),
    beforeId: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine((query) => query.before !== undefined || query.beforeId === undefined, {
    message: 'beforeId requires before',
    path: ['beforeId'],
  });

export const auditEventListResponseSchema = z
  .object({
    events: z.array(auditEventSchema),
  })
  .strict();

export type AuditAudience = z.infer<typeof auditAudienceSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type CreateAuditEventInput = z.infer<typeof createAuditEventInputSchema>;
export type AuditEventQuery = z.infer<typeof auditEventQuerySchema>;
export type AuditEventListResponse = z.infer<typeof auditEventListResponseSchema>;
