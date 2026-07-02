import { z } from 'zod';

import { projectIdSchema } from './projects.js';

export const schedulePhaseIdSchema = z.uuid();
export const scheduleMilestoneIdSchema = z.uuid();
export const scheduleBaselineIdSchema = z.uuid();
export const scheduleForecastMoveIdSchema = z.uuid();
export const drawItemIdSchema = z.uuid();
export const scheduleBaselineStatusSchema = z.enum([
  'draft',
  'proposed',
  'agreed',
  'self_certified',
]);

const dateOnlySchema = z.iso.date();
const optionalDateOnlySchema = dateOnlySchema.nullable().optional();
const scheduleNameSchema = z.string().trim().min(1).max(160);
const scheduleDescriptionSchema = z.string().trim().min(1).max(1000).nullable();
const scheduleReasonSchema = z.string().trim().min(1).max(1000);
const displayOrderSchema = z.number().int().min(0).max(100_000);

const validatePhaseDateOrder = (
  value: { startsOn?: string | null; endsOn?: string | null },
  context: z.RefinementCtx,
) => {
  if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({
      code: 'custom',
      message: 'Phase endsOn cannot be before startsOn',
      path: ['endsOn'],
    });
  }
};

export const createSchedulePhaseRequestSchema = z
  .object({
    name: scheduleNameSchema,
    startsOn: optionalDateOnlySchema,
    endsOn: optionalDateOnlySchema,
    displayOrder: displayOrderSchema.default(0),
  })
  .strict()
  .superRefine(validatePhaseDateOrder);

export const updateSchedulePhaseRequestSchema = z
  .object({
    name: scheduleNameSchema.optional(),
    startsOn: optionalDateOnlySchema,
    endsOn: optionalDateOnlySchema,
    displayOrder: displayOrderSchema.optional(),
  })
  .strict()
  .superRefine(validatePhaseDateOrder)
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one phase field is required',
  });

export const createScheduleMilestoneRequestSchema = z
  .object({
    phaseId: schedulePhaseIdSchema,
    name: scheduleNameSchema,
    description: scheduleDescriptionSchema.optional(),
    forecastDate: dateOnlySchema,
    displayOrder: displayOrderSchema.default(0),
  })
  .strict();

export const updateScheduleMilestoneRequestSchema = z
  .object({
    phaseId: schedulePhaseIdSchema.optional(),
    name: scheduleNameSchema.optional(),
    description: scheduleDescriptionSchema.optional(),
    displayOrder: displayOrderSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one milestone field is required',
  });

export const moveForecastDateRequestSchema = z
  .object({
    forecastDate: dateOnlySchema,
    reason: scheduleReasonSchema,
  })
  .strict();

export const replaceMilestoneDrawLinksRequestSchema = z
  .object({
    drawItemIds: z
      .array(drawItemIdSchema)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Draw item ids must be unique',
      }),
  })
  .strict();

export const selfCertifyBaselineRequestSchema = z
  .object({
    reason: scheduleReasonSchema,
  })
  .strict();

export const schedulePhaseSchema = z
  .object({
    id: schedulePhaseIdSchema,
    projectId: projectIdSchema,
    workspaceId: z.uuid(),
    name: scheduleNameSchema,
    startsOn: dateOnlySchema.nullable(),
    endsOn: dateOnlySchema.nullable(),
    displayOrder: displayOrderSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine(validatePhaseDateOrder);

export const scheduleMilestoneSchema = z
  .object({
    id: scheduleMilestoneIdSchema,
    projectId: projectIdSchema,
    workspaceId: z.uuid(),
    phaseId: schedulePhaseIdSchema,
    name: scheduleNameSchema,
    description: scheduleDescriptionSchema,
    forecastDate: dateOnlySchema,
    completedAt: z.iso.datetime().nullable(),
    completedByUserId: z.uuid().nullable(),
    displayOrder: displayOrderSchema,
    drawItemIds: z.array(drawItemIdSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const scheduleBaselineMilestoneSchema = z
  .object({
    id: z.uuid(),
    baselineId: scheduleBaselineIdSchema,
    sourceMilestoneId: scheduleMilestoneIdSchema.nullable(),
    phaseName: scheduleNameSchema,
    milestoneName: scheduleNameSchema,
    baselineDate: dateOnlySchema,
    displayOrder: displayOrderSchema,
  })
  .strict();

export const scheduleBaselineSchema = z
  .object({
    id: scheduleBaselineIdSchema,
    workspaceId: z.uuid(),
    projectId: projectIdSchema,
    status: scheduleBaselineStatusSchema,
    proposedByUserId: z.uuid().nullable(),
    signOffId: z.uuid().nullable(),
    selfCertifiedByUserId: z.uuid().nullable(),
    selfCertifiedReason: scheduleReasonSchema.nullable(),
    agreedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    milestones: z.array(scheduleBaselineMilestoneSchema),
  })
  .strict();

export const scheduleForecastMoveSchema = z
  .object({
    id: scheduleForecastMoveIdSchema,
    workspaceId: z.uuid(),
    projectId: projectIdSchema,
    milestoneId: scheduleMilestoneIdSchema,
    oldForecastDate: dateOnlySchema,
    newForecastDate: dateOnlySchema,
    reason: scheduleReasonSchema,
    movedByUserId: z.uuid(),
    movedAt: z.iso.datetime(),
  })
  .strict();

export const scheduleResponseSchema = z
  .object({
    projectId: projectIdSchema,
    phases: z.array(schedulePhaseSchema),
    milestones: z.array(scheduleMilestoneSchema),
    baseline: scheduleBaselineSchema.nullable(),
    forecastMoves: z.array(scheduleForecastMoveSchema),
  })
  .strict();

export type SchedulePhaseId = z.infer<typeof schedulePhaseIdSchema>;
export type ScheduleMilestoneId = z.infer<typeof scheduleMilestoneIdSchema>;
export type ScheduleBaselineId = z.infer<typeof scheduleBaselineIdSchema>;
export type ScheduleForecastMoveId = z.infer<typeof scheduleForecastMoveIdSchema>;
export type DrawItemId = z.infer<typeof drawItemIdSchema>;
export type ScheduleBaselineStatus = z.infer<typeof scheduleBaselineStatusSchema>;
export type CreateSchedulePhaseRequest = z.infer<typeof createSchedulePhaseRequestSchema>;
export type UpdateSchedulePhaseRequest = z.infer<typeof updateSchedulePhaseRequestSchema>;
export type CreateScheduleMilestoneRequest = z.infer<typeof createScheduleMilestoneRequestSchema>;
export type UpdateScheduleMilestoneRequest = z.infer<typeof updateScheduleMilestoneRequestSchema>;
export type MoveForecastDateRequest = z.infer<typeof moveForecastDateRequestSchema>;
export type ReplaceMilestoneDrawLinksRequest = z.infer<
  typeof replaceMilestoneDrawLinksRequestSchema
>;
export type SelfCertifyBaselineRequest = z.infer<typeof selfCertifyBaselineRequestSchema>;
export type SchedulePhase = z.infer<typeof schedulePhaseSchema>;
export type ScheduleMilestone = z.infer<typeof scheduleMilestoneSchema>;
export type ScheduleBaselineMilestone = z.infer<typeof scheduleBaselineMilestoneSchema>;
export type ScheduleBaseline = z.infer<typeof scheduleBaselineSchema>;
export type ScheduleForecastMove = z.infer<typeof scheduleForecastMoveSchema>;
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
