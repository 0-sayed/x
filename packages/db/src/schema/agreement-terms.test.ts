import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { agreementTerms } from './agreement-terms.js';

describe('agreement terms schema', () => {
  it('uses workspace-scoped agreement terms columns', () => {
    expect(agreementTerms.id.name).toBe('id');
    expect(agreementTerms.workspaceId.name).toBe('workspace_id');
    expect(agreementTerms.projectId.name).toBe('project_id');
    expect(agreementTerms.commercialModel.name).toBe('commercial_model');
    expect(agreementTerms.currency.name).toBe('currency');
    expect(agreementTerms.disclosureDepth.name).toBe('disclosure_depth');
    expect(agreementTerms.retentionPercentage.name).toBe('retention_percentage');
    expect(agreementTerms.billingCycle.name).toBe('billing_cycle');
  });

  it('stores model-specific money, fee, GMP, and auto-contract fields', () => {
    const columns = getTableColumns(agreementTerms);

    expect(columns.contractValueMinor.name).toBe('contract_value_minor');
    expect(columns.feeBasis.name).toBe('fee_basis');
    expect(columns.feePercentageBps.name).toBe('fee_percentage_bps');
    expect(columns.feeAmountMinor.name).toBe('fee_amount_minor');
    expect(columns.targetCostMinor.name).toBe('target_cost_minor');
    expect(columns.gmpCeilingMinor.name).toBe('gmp_ceiling_minor');
    expect(columns.savingsSplitContractorBps.name).toBe('savings_split_contractor_bps');
    expect(columns.reimbursableCostCategories.name).toBe('reimbursable_cost_categories');
    expect(columns.contractSnapshotMarkdown.name).toBe('contract_snapshot_markdown');
    expect(columns.contractSnapshotGeneratedAt.name).toBe('contract_snapshot_generated_at');
  });

  it('stores lock and audit metadata', () => {
    const columns = getTableColumns(agreementTerms);

    expect(columns.lockedAt.name).toBe('locked_at');
    expect(columns.lockedByUserId.name).toBe('locked_by_user_id');
    expect(columns.lockedByDrawItemId.name).toBe('locked_by_draw_item_id');
    expect(columns.lockReason.name).toBe('lock_reason');
    expect(columns.configuredByUserId.name).toBe('configured_by_user_id');
    expect(columns.createdAt.name).toBe('created_at');
    expect(columns.updatedAt.name).toBe('updated_at');
  });

  it('defines checks and foreign keys for project-scoped terms', () => {
    const config = getTableConfig(agreementTerms);

    expect(config.foreignKeys.map((foreignKey) => foreignKey.getName()).sort()).toEqual(
      expect.arrayContaining([
        'agreement_terms_workspace_id_project_id_projects_workspace_id_id_fk',
        'agreement_terms_workspace_id_workspace_refs_id_fk',
      ]),
    );
    expect(config.checks.map((check) => check.name).sort()).toEqual(
      expect.arrayContaining([
        'agreement_terms_billing_cycle_check',
        'agreement_terms_commercial_model_check',
        'agreement_terms_cost_plus_shape_check',
        'agreement_terms_lump_sum_shape_check',
        'agreement_terms_remeasured_shape_check',
        'agreement_terms_retention_percentage_check',
      ]),
    );
  });

  it('defines model shape checks that reject non-applicable fields', () => {
    const checks = new Map(
      getTableConfig(agreementTerms).checks.map((check) => [
        check.name,
        check.value.queryChunks.flatMap((chunk) => (chunk && 'name' in chunk ? [chunk.name] : [])),
      ]),
    );

    expect(checks.get('agreement_terms_lump_sum_shape_check')).toEqual(
      expect.arrayContaining(['fee_amount_minor', 'fee_applies_to_subs']),
    );
    expect(checks.get('agreement_terms_cost_plus_shape_check')).toEqual(
      expect.arrayContaining(['contract_value_minor']),
    );
    expect(checks.get('agreement_terms_remeasured_shape_check')).toEqual(
      expect.arrayContaining(['fee_applies_to_change_orders']),
    );
  });
});
