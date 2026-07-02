import { z } from 'zod';

import { currencyCodeSchema } from './money.js';
import { defaultDisclosureDepthSchema } from './settings.js';

export const agreementTermsIdSchema = z.uuid();
export const commercialModelSchema = z.enum(['lump_sum', 'cost_plus', 'remeasured']);
export const feeBasisSchema = z.enum(['percentage', 'fixed']);
export const billingCycleSchema = z.enum(['milestone', 'monthly', 'biweekly']);

const minorUnitsSchema = z.number().int().min(0);
const percentageSchema = z.number().int().min(0).max(100);
const basisPointsSchema = z.number().int().min(0).max(10_000);
const categorySchema = z.string().trim().min(1).max(80);

const baseConfigureAgreementTermsRequestSchema = z
  .object({
    commercialModel: commercialModelSchema,
    currency: currencyCodeSchema,
    disclosureDepth: defaultDisclosureDepthSchema,
    retentionPercentage: percentageSchema,
    billingCycle: billingCycleSchema,
  })
  .strict();

const percentageFeeSchema = z
  .object({
    feeBasis: z.literal('percentage'),
    feePercentageBps: basisPointsSchema,
    feeAmountMinor: z.never().optional(),
  })
  .strict();

const fixedFeeSchema = z
  .object({
    feeBasis: z.literal('fixed'),
    feeAmountMinor: minorUnitsSchema,
    feePercentageBps: z.never().optional(),
  })
  .strict();

const feeSchema = z.discriminatedUnion('feeBasis', [percentageFeeSchema, fixedFeeSchema]);

export const lumpSumAgreementTermsRequestSchema = baseConfigureAgreementTermsRequestSchema
  .extend({
    commercialModel: z.literal('lump_sum'),
    contractValueMinor: minorUnitsSchema,
  })
  .strict();

export const costPlusAgreementTermsRequestSchema = baseConfigureAgreementTermsRequestSchema
  .extend({
    commercialModel: z.literal('cost_plus'),
    targetCostMinor: minorUnitsSchema.optional(),
    gmpCeilingMinor: minorUnitsSchema.optional(),
    savingsSplitContractorBps: basisPointsSchema.optional(),
    reimbursableCostCategories: z
      .array(categorySchema)
      .min(1)
      .refine((categories) => new Set(categories).size === categories.length, {
        message: 'Reimbursable categories must be unique',
      }),
    feeAppliesToSubs: z.boolean().default(false),
    feeAppliesToChangeOrders: z.boolean().default(false),
  })
  .and(feeSchema)
  .superRefine((value, ctx) => {
    if (value.gmpCeilingMinor !== undefined && value.savingsSplitContractorBps === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['savingsSplitContractorBps'],
        message: 'Savings split is required when GMP ceiling is set',
      });
    }
    if (value.gmpCeilingMinor === undefined && value.savingsSplitContractorBps !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['gmpCeilingMinor'],
        message: 'GMP ceiling is required when savings split is set',
      });
    }
  });

export const remeasuredAgreementTermsRequestSchema = baseConfigureAgreementTermsRequestSchema
  .extend({
    commercialModel: z.literal('remeasured'),
  })
  .and(feeSchema);

export const configureAgreementTermsRequestSchema = z.union([
  lumpSumAgreementTermsRequestSchema,
  costPlusAgreementTermsRequestSchema,
  remeasuredAgreementTermsRequestSchema,
]);

export const agreementTermsSchema = z
  .object({
    id: agreementTermsIdSchema,
    workspaceId: z.uuid(),
    projectId: z.uuid(),
    commercialModel: commercialModelSchema,
    currency: currencyCodeSchema,
    disclosureDepth: defaultDisclosureDepthSchema,
    retentionPercentage: percentageSchema,
    billingCycle: billingCycleSchema,
    contractValueMinor: minorUnitsSchema.nullable(),
    feeBasis: feeBasisSchema.nullable(),
    feePercentageBps: basisPointsSchema.nullable(),
    feeAmountMinor: minorUnitsSchema.nullable(),
    targetCostMinor: minorUnitsSchema.nullable(),
    gmpCeilingMinor: minorUnitsSchema.nullable(),
    savingsSplitContractorBps: basisPointsSchema.nullable(),
    reimbursableCostCategories: z.array(categorySchema).nullable(),
    feeAppliesToSubs: z.boolean().nullable(),
    feeAppliesToChangeOrders: z.boolean().nullable(),
    contractSnapshotMarkdown: z.string().min(1),
    contractSnapshotGeneratedAt: z.iso.datetime(),
    lockedAt: z.iso.datetime().nullable(),
    lockedByUserId: z.uuid().nullable(),
    lockedByDrawItemId: z.uuid().nullable(),
    lockReason: z.literal('first_draw_item_approved').nullable(),
    configuredByUserId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.feeBasis === null) {
      requireNull(ctx, value.feePercentageBps, ['feePercentageBps']);
      requireNull(ctx, value.feeAmountMinor, ['feeAmountMinor']);
    }
    if (value.feeBasis === 'percentage') {
      requirePresent(ctx, value.feePercentageBps, ['feePercentageBps']);
      requireNull(ctx, value.feeAmountMinor, ['feeAmountMinor']);
    }
    if (value.feeBasis === 'fixed') {
      requirePresent(ctx, value.feeAmountMinor, ['feeAmountMinor']);
      requireNull(ctx, value.feePercentageBps, ['feePercentageBps']);
    }

    if (value.commercialModel === 'lump_sum') {
      requirePresent(ctx, value.contractValueMinor, ['contractValueMinor']);
      requireNulls(ctx, value, [
        'feeBasis',
        'feePercentageBps',
        'feeAmountMinor',
        'targetCostMinor',
        'gmpCeilingMinor',
        'savingsSplitContractorBps',
        'reimbursableCostCategories',
        'feeAppliesToSubs',
        'feeAppliesToChangeOrders',
      ]);
    }

    if (value.commercialModel === 'cost_plus') {
      requireNull(ctx, value.contractValueMinor, ['contractValueMinor']);
      requirePresent(ctx, value.feeBasis, ['feeBasis']);
      requirePresent(ctx, value.reimbursableCostCategories, ['reimbursableCostCategories']);
      requirePresent(ctx, value.feeAppliesToSubs, ['feeAppliesToSubs']);
      requirePresent(ctx, value.feeAppliesToChangeOrders, ['feeAppliesToChangeOrders']);
      requireGmpPair(ctx, value.gmpCeilingMinor, value.savingsSplitContractorBps);
    }

    if (value.commercialModel === 'remeasured') {
      requirePresent(ctx, value.feeBasis, ['feeBasis']);
      requireNulls(ctx, value, [
        'contractValueMinor',
        'targetCostMinor',
        'gmpCeilingMinor',
        'savingsSplitContractorBps',
        'reimbursableCostCategories',
        'feeAppliesToSubs',
        'feeAppliesToChangeOrders',
      ]);
    }
  });

export const agreementTermsResponseSchema = z
  .object({
    terms: agreementTermsSchema.nullable(),
  })
  .strict();

export type CommercialModel = z.infer<typeof commercialModelSchema>;
export type FeeBasis = z.infer<typeof feeBasisSchema>;
export type BillingCycle = z.infer<typeof billingCycleSchema>;
export type ConfigureAgreementTermsRequest = z.infer<typeof configureAgreementTermsRequestSchema>;
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;
export type AgreementTermsResponse = z.infer<typeof agreementTermsResponseSchema>;

function requirePresent(ctx: z.RefinementCtx, value: unknown, path: (string | number)[]) {
  if (value === null) {
    ctx.addIssue({ code: 'custom', path, message: 'Field is required for this terms shape' });
  }
}

function requireNull(ctx: z.RefinementCtx, value: unknown, path: (string | number)[]) {
  if (value !== null) {
    ctx.addIssue({ code: 'custom', path, message: 'Field must be null for this terms shape' });
  }
}

function requireNulls<T extends Record<string, unknown>>(
  ctx: z.RefinementCtx,
  value: T,
  keys: (keyof T & string)[],
) {
  for (const key of keys) {
    requireNull(ctx, value[key], [key]);
  }
}

function requireGmpPair(
  ctx: z.RefinementCtx,
  gmpCeilingMinor: number | null,
  savingsSplitContractorBps: number | null,
) {
  if (gmpCeilingMinor !== null && savingsSplitContractorBps === null) {
    requirePresent(ctx, savingsSplitContractorBps, ['savingsSplitContractorBps']);
  }
  if (gmpCeilingMinor === null && savingsSplitContractorBps !== null) {
    requirePresent(ctx, gmpCeilingMinor, ['gmpCeilingMinor']);
  }
}
