import { describe, expect, it } from 'vitest';

import {
  agreementTermsResponseSchema,
  commercialModelSchema,
  configureAgreementTermsRequestSchema,
} from './agreement-terms.js';

const base = {
  currency: 'SAR',
  disclosureDepth: 'category',
  retentionPercentage: 5,
  billingCycle: 'monthly',
} as const;

describe('agreement terms contracts', () => {
  it('accepts the three commercial models and rejects GMP as a model', () => {
    expect(commercialModelSchema.parse('lump_sum')).toBe('lump_sum');
    expect(commercialModelSchema.parse('cost_plus')).toBe('cost_plus');
    expect(commercialModelSchema.parse('remeasured')).toBe('remeasured');
    expect(() => commercialModelSchema.parse('gmp')).toThrow();
  });

  it('accepts lump-sum terms with a contract value', () => {
    expect(
      configureAgreementTermsRequestSchema.parse({
        ...base,
        commercialModel: 'lump_sum',
        contractValueMinor: 2_500_000,
      }),
    ).toEqual({
      ...base,
      commercialModel: 'lump_sum',
      contractValueMinor: 2_500_000,
    });
  });

  it('requires cost-plus GMP savings split only when a GMP ceiling is set', () => {
    expect(() =>
      configureAgreementTermsRequestSchema.parse({
        ...base,
        commercialModel: 'cost_plus',
        feeBasis: 'percentage',
        feePercentageBps: 1_250,
        reimbursableCostCategories: ['materials', 'labor'],
        gmpCeilingMinor: 5_000_000,
      }),
    ).toThrow();

    expect(
      configureAgreementTermsRequestSchema.parse({
        ...base,
        commercialModel: 'cost_plus',
        feeBasis: 'percentage',
        feePercentageBps: 1_250,
        targetCostMinor: 4_500_000,
        gmpCeilingMinor: 5_000_000,
        savingsSplitContractorBps: 4_000,
        reimbursableCostCategories: ['materials', 'labor'],
        feeAppliesToSubs: true,
        feeAppliesToChangeOrders: false,
      }),
    ).toEqual({
      ...base,
      commercialModel: 'cost_plus',
      feeBasis: 'percentage',
      feePercentageBps: 1_250,
      targetCostMinor: 4_500_000,
      gmpCeilingMinor: 5_000_000,
      savingsSplitContractorBps: 4_000,
      reimbursableCostCategories: ['materials', 'labor'],
      feeAppliesToSubs: true,
      feeAppliesToChangeOrders: false,
    });
  });

  it('accepts remeasured terms with fee mechanics and no cost-plus fields', () => {
    expect(
      configureAgreementTermsRequestSchema.parse({
        ...base,
        commercialModel: 'remeasured',
        feeBasis: 'fixed',
        feeAmountMinor: 150_000,
      }),
    ).toEqual({
      ...base,
      commercialModel: 'remeasured',
      feeBasis: 'fixed',
      feeAmountMinor: 150_000,
    });
  });

  it('serializes nullable agreement terms responses', () => {
    expect(agreementTermsResponseSchema.parse({ terms: null })).toEqual({ terms: null });
  });

  it('rejects response terms with fields from another commercial model', () => {
    const terms = {
      id: '07e3ab28-e188-4b03-a8fc-aec2e4d03243',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      commercialModel: 'lump_sum',
      currency: 'SAR',
      disclosureDepth: 'category',
      retentionPercentage: 5,
      billingCycle: 'monthly',
      contractValueMinor: 2_500_000,
      feeBasis: 'fixed',
      feePercentageBps: null,
      feeAmountMinor: 150_000,
      targetCostMinor: null,
      gmpCeilingMinor: null,
      savingsSplitContractorBps: null,
      reimbursableCostCategories: null,
      feeAppliesToSubs: null,
      feeAppliesToChangeOrders: null,
      contractSnapshotMarkdown: '# Agreement Terms\n',
      contractSnapshotGeneratedAt: '2026-07-02T09:00:00.000Z',
      lockedAt: null,
      lockedByUserId: null,
      lockedByDrawItemId: null,
      lockReason: null,
      configuredByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      createdAt: '2026-07-02T09:00:00.000Z',
      updatedAt: '2026-07-02T09:00:00.000Z',
    };

    expect(() => agreementTermsResponseSchema.parse({ terms })).toThrow();
  });
});
