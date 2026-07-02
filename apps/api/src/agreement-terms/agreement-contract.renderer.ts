import type { AgreementTerms } from '@materiabill/contracts';

type SnapshotInput = Pick<
  AgreementTerms,
  | 'projectId'
  | 'commercialModel'
  | 'currency'
  | 'disclosureDepth'
  | 'retentionPercentage'
  | 'billingCycle'
  | 'contractValueMinor'
  | 'feeBasis'
  | 'feePercentageBps'
  | 'feeAmountMinor'
  | 'targetCostMinor'
  | 'gmpCeilingMinor'
  | 'savingsSplitContractorBps'
  | 'reimbursableCostCategories'
  | 'feeAppliesToSubs'
  | 'feeAppliesToChangeOrders'
>;

export function renderAgreementContractSnapshot(input: SnapshotInput): string {
  const lines = [
    '# Agreement Terms',
    '',
    `- Project: ${input.projectId}`,
    `- Commercial model: ${input.commercialModel}`,
    `- Currency: ${input.currency}`,
    `- Disclosure depth: ${input.disclosureDepth}`,
    `- Retention: ${String(input.retentionPercentage)}%`,
    `- Billing cycle: ${input.billingCycle}`,
  ];

  if (input.contractValueMinor !== null) {
    lines.push(`- Contract value: ${formatMoney(input.currency, input.contractValueMinor)}`);
  }

  if (input.feeBasis === 'percentage' && input.feePercentageBps !== null) {
    lines.push(`- Fee: ${formatBps(input.feePercentageBps)}`);
  }

  if (input.feeBasis === 'fixed' && input.feeAmountMinor !== null) {
    lines.push(`- Fee: ${formatMoney(input.currency, input.feeAmountMinor)}`);
  }

  if (input.targetCostMinor !== null) {
    lines.push(`- Target cost: ${formatMoney(input.currency, input.targetCostMinor)}`);
  }

  if (input.gmpCeilingMinor !== null) {
    lines.push(`- GMP ceiling: ${formatMoney(input.currency, input.gmpCeilingMinor)}`);
  }

  if (input.savingsSplitContractorBps !== null) {
    lines.push(`- Contractor savings split: ${formatBps(input.savingsSplitContractorBps)}`);
  }

  if (input.reimbursableCostCategories !== null) {
    lines.push(`- Reimbursable categories: ${input.reimbursableCostCategories.join(', ')}`);
  }

  if (input.feeAppliesToSubs !== null) {
    lines.push(`- Fee applies to subcontractors: ${input.feeAppliesToSubs ? 'yes' : 'no'}`);
  }

  if (input.feeAppliesToChangeOrders !== null) {
    lines.push(`- Fee applies to change orders: ${input.feeAppliesToChangeOrders ? 'yes' : 'no'}`);
  }

  lines.push(
    '- Lock rule: terms become immutable when the first draw item is approved by the client.',
  );

  return `${lines.join('\n')}\n`;
}

function formatMoney(currency: string, amountMinor: number): string {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function formatBps(value: number): string {
  const percent = value / 100;
  const formatted = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return `${formatted}%`;
}
