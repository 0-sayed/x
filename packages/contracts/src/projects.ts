import { z } from 'zod';

import { currencyCodeSchema } from './money.js';

export const projectIdSchema = z.uuid();
export const projectStatusSchema = z.enum(['on_plan', 'behind', 'stale']);
export const projectRoleFilterSchema = z.enum(['main_contractor', 'as_subcontract']);

const nullableUuidSchema = z.uuid().nullable().optional();
const projectTextSchema = z.string().trim().min(1);
const dateOnlySchema = z.iso.date();
const hasExactlyOneProjectClient = (value: {
  readonly endCustomerId?: string | null;
  readonly clientOrgId?: string | null;
}) => Number(Boolean(value.endCustomerId)) + Number(Boolean(value.clientOrgId)) === 1;
const booleanQuerySchema = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}, z.boolean());

export const projectParticipantInputSchema = z
  .object({
    userId: z.uuid(),
    roleLabel: projectTextSchema.max(120),
  })
  .strict();

export const createProjectRequestSchema = z
  .object({
    name: projectTextSchema.max(160),
    city: projectTextSchema.max(120),
    currency: currencyCodeSchema,
    status: projectStatusSchema.default('on_plan'),
    now: z.string().trim().max(240).nullable().optional(),
    bottleneck: z.string().trim().max(240).nullable().optional(),
    baselineDeliveryDate: dateOnlySchema,
    pmUserId: nullableUuidSchema,
    locationId: nullableUuidSchema,
    clientOrgId: nullableUuidSchema,
    endCustomerId: nullableUuidSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!hasExactlyOneProjectClient(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exactly one project client is required',
      });
    }
  });

export const updateProjectRequestSchema = z
  .object({
    name: projectTextSchema.max(160).optional(),
    city: projectTextSchema.max(120).optional(),
    status: projectStatusSchema.optional(),
    now: z.string().trim().max(240).nullable().optional(),
    bottleneck: z.string().trim().max(240).nullable().optional(),
    pmUserId: nullableUuidSchema,
    locationId: nullableUuidSchema,
    clientOrgId: nullableUuidSchema,
    endCustomerId: nullableUuidSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one project field is required',
  })
  .superRefine((value, ctx) => {
    if ('endCustomerId' in value && 'clientOrgId' in value && !hasExactlyOneProjectClient(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Project cannot have both or neither endCustomerId and clientOrgId',
      });
    }
  });

export const projectListQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(120).optional(),
    pmUserId: z.uuid().optional(),
    status: projectStatusSchema.optional(),
    role: projectRoleFilterSchema.optional(),
    includeArchived: booleanQuerySchema.default(false),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: projectIdSchema.optional(),
  })
  .strict();

export const replaceProjectParticipantsRequestSchema = z
  .object({
    participants: z
      .array(projectParticipantInputSchema)
      .max(100)
      .refine(
        (participants) =>
          new Set(participants.map((item) => item.userId)).size === participants.length,
        {
          message: 'Participant user ids must be unique',
        },
      ),
  })
  .strict();

export const projectParticipantSchema = z
  .object({
    projectId: projectIdSchema,
    workspaceId: z.uuid(),
    userId: z.uuid(),
    roleLabel: projectTextSchema.max(120),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const projectSummarySchema = z
  .object({
    id: projectIdSchema,
    workspaceId: z.uuid(),
    name: projectTextSchema.max(160),
    city: projectTextSchema.max(120),
    currency: currencyCodeSchema,
    status: projectStatusSchema,
    now: z.string().nullable(),
    bottleneck: z.string().nullable(),
    baselineDeliveryDate: dateOnlySchema,
    pmUserId: z.uuid().nullable(),
    locationId: z.uuid().nullable(),
    clientOrgId: z.uuid().nullable(),
    endCustomerId: z.uuid().nullable(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    participantCount: z.number().int().min(0),
  })
  .strict();

export const projectDetailSchema = projectSummarySchema
  .extend({
    participants: z.array(projectParticipantSchema),
  })
  .strict();

export const projectListResponseSchema = z
  .object({
    projects: z.array(projectSummarySchema),
    nextCursor: projectIdSchema.nullable(),
  })
  .strict();

export const projectParticipantsResponseSchema = z
  .object({
    participants: z.array(projectParticipantSchema),
  })
  .strict();

export type ProjectId = z.infer<typeof projectIdSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectRoleFilter = z.infer<typeof projectRoleFilterSchema>;
export type ProjectParticipantInput = z.infer<typeof projectParticipantInputSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type ReplaceProjectParticipantsRequest = z.infer<
  typeof replaceProjectParticipantsRequestSchema
>;
export type ProjectParticipant = z.infer<typeof projectParticipantSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
export type ProjectParticipantsResponse = z.infer<typeof projectParticipantsResponseSchema>;
