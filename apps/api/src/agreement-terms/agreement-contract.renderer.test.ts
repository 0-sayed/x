import { describe, expect, it } from 'vitest';

import { renderAgreementContractSnapshot } from './agreement-contract.renderer.js';

describe('renderAgreementContractSnapshot', () => {
  it('renders deterministic cost-plus GMP contract terms', () => {
    expect(
      renderAgreementContractSnapshot({
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        commercialModel: 'cost_plus',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        feeBasis: 'percentage',
        feePercentageBps: 1_250,
        feeAmountMinor: null,
        contractValueMinor: null,
        targetCostMinor: 4_500_000,
        gmpCeilingMinor: 5_000_000,
        savingsSplitContractorBps: 4_000,
        reimbursableCostCategories: ['materials', 'labor'],
        feeAppliesToSubs: true,
        feeAppliesToChangeOrders: false,
      }),
    ).toBe(`# Agreement Terms

- Project: c5d9ed84-6469-4889-995d-cd38994fb7dd
- Commercial model: cost_plus
- Currency: SAR
- Disclosure depth: category
- Retention: 5%
- Billing cycle: monthly
- Fee: 12.5%
- Target cost: SAR 45000.00
- GMP ceiling: SAR 50000.00
- Contractor savings split: 40%
- Reimbursable categories: materials, labor
- Fee applies to subcontractors: yes
- Fee applies to change orders: no
- Lock rule: terms become immutable when the first draw item is approved by the client.
`);
  });
});
