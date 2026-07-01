import { z } from 'zod';

import { decisionAudienceSchema, pendingDecisionSchema } from './grace-window.js';

export const signOffIdSchema = z.uuid();
export const signOffStatusSchema = z.enum(['pending', 'approved', 'rejected', 'signed']);
export const signOffRequiredActionSchema = z.enum(['approve', 'sign']);
export const signOffResolutionActionSchema = z.enum(['approve', 'reject', 'sign']);
export const signOffAssignedAudienceSchema = decisionAudienceSchema;

const signOffSubjectTypeSchema = z.string().trim().min(1).max(80);
const signOffSubjectIdSchema = z.string().trim().min(1).max(120);
const signOffTitleSchema = z.string().trim().min(1).max(200);
const signOffSummarySchema = z.string().trim().min(1).max(1000).nullable();
const signOffReasonSchema = z.string().trim().min(1).max(1000);

export const createSignOffInputSchema = z
  .object({
    workspaceId: z.uuid(),
    projectId: z.uuid(),
    subjectType: signOffSubjectTypeSchema,
    subjectId: signOffSubjectIdSchema,
    title: signOffTitleSchema,
    summary: signOffSummarySchema.optional(),
    assignedAudience: signOffAssignedAudienceSchema,
    requiredAction: signOffRequiredActionSchema,
    requestedByUserId: z.uuid().nullable(),
  })
  .strict();

export const signOffSchema = z
  .object({
    id: signOffIdSchema,
    workspaceId: z.uuid(),
    projectId: z.uuid(),
    subjectType: signOffSubjectTypeSchema,
    subjectId: signOffSubjectIdSchema,
    title: signOffTitleSchema,
    summary: signOffSummarySchema,
    assignedAudience: signOffAssignedAudienceSchema,
    requiredAction: signOffRequiredActionSchema,
    status: signOffStatusSchema,
    requestedByUserId: z.uuid().nullable(),
    resolvedByUserId: z.uuid().nullable(),
    resolutionReason: signOffReasonSchema.nullable(),
    resolutionDecisionId: z.uuid().nullable(),
    lastReminderAt: z.iso.datetime().nullable(),
    reminderCount: z.number().int().min(0),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const signOffListQuerySchema = z
  .object({
    projectId: z.uuid().optional(),
    status: signOffStatusSchema.optional(),
    assignedAudience: signOffAssignedAudienceSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const signOffListResponseSchema = z
  .object({
    signOffs: z.array(signOffSchema),
  })
  .strict();

export const resolveSignOffRequestSchema = z
  .object({
    action: signOffResolutionActionSchema,
    reason: signOffReasonSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'reject' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Rejecting a sign-off requires a reason',
      });
    }
  });

export const resolveSignOffResponseSchema = z
  .object({
    signOff: signOffSchema,
    pendingDecision: pendingDecisionSchema,
  })
  .strict();

export const signOffReminderResponseSchema = z
  .object({
    signOff: signOffSchema,
  })
  .strict();

export type SignOff = z.infer<typeof signOffSchema>;
export type SignOffStatus = z.infer<typeof signOffStatusSchema>;
export type SignOffRequiredAction = z.infer<typeof signOffRequiredActionSchema>;
export type SignOffResolutionAction = z.infer<typeof signOffResolutionActionSchema>;
export type SignOffAssignedAudience = z.infer<typeof signOffAssignedAudienceSchema>;
export type CreateSignOffInput = z.input<typeof createSignOffInputSchema>;
export type ParsedCreateSignOffInput = z.infer<typeof createSignOffInputSchema>;
export type SignOffListQuery = z.infer<typeof signOffListQuerySchema>;
export type SignOffListResponse = z.infer<typeof signOffListResponseSchema>;
export type ResolveSignOffRequest = z.infer<typeof resolveSignOffRequestSchema>;
export type ResolveSignOffResponse = z.infer<typeof resolveSignOffResponseSchema>;
export type SignOffReminderResponse = z.infer<typeof signOffReminderResponseSchema>;
