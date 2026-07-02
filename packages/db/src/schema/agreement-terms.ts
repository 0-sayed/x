import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  BillingCycle,
  CommercialModel,
  DefaultDisclosureDepth,
  FeeBasis,
} from '@materiabill/contracts';

import { inframodernUserRefs, workspaceRefs } from './projections.js';
import { projects } from './projects.js';

const commercialModelSql = sql`'lump_sum', 'cost_plus', 'remeasured'`;
const feeBasisSql = sql`'percentage', 'fixed'`;
const disclosureDepthSql = sql`'none', 'category', 'line'`;
const billingCycleSql = sql`'milestone', 'monthly', 'biweekly'`;

export const agreementTerms = pgTable(
  'agreement_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaceRefs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    commercialModel: varchar('commercial_model', { length: 16 }).$type<CommercialModel>().notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    disclosureDepth: varchar('disclosure_depth', { length: 16 })
      .$type<DefaultDisclosureDepth>()
      .notNull(),
    retentionPercentage: integer('retention_percentage').notNull(),
    billingCycle: varchar('billing_cycle', { length: 16 }).$type<BillingCycle>().notNull(),
    contractValueMinor: integer('contract_value_minor'),
    feeBasis: varchar('fee_basis', { length: 16 }).$type<FeeBasis>(),
    feePercentageBps: integer('fee_percentage_bps'),
    feeAmountMinor: integer('fee_amount_minor'),
    targetCostMinor: integer('target_cost_minor'),
    gmpCeilingMinor: integer('gmp_ceiling_minor'),
    savingsSplitContractorBps: integer('savings_split_contractor_bps'),
    reimbursableCostCategories: jsonb('reimbursable_cost_categories').$type<string[]>(),
    feeAppliesToSubs: boolean('fee_applies_to_subs'),
    feeAppliesToChangeOrders: boolean('fee_applies_to_change_orders'),
    contractSnapshotMarkdown: text('contract_snapshot_markdown').notNull(),
    contractSnapshotGeneratedAt: timestamp('contract_snapshot_generated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedByUserId: uuid('locked_by_user_id').references(() => inframodernUserRefs.id, {
      onDelete: 'set null',
    }),
    lockedByDrawItemId: uuid('locked_by_draw_item_id'),
    lockReason: varchar('lock_reason', { length: 80 }),
    configuredByUserId: uuid('configured_by_user_id')
      .notNull()
      .references(() => inframodernUserRefs.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('agreement_terms_workspace_id_project_id_unique').on(table.workspaceId, table.projectId),
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'agreement_terms_workspace_id_project_id_projects_workspace_id_id_fk',
    }).onDelete('cascade'),
    index('agreement_terms_workspace_project_idx').on(table.workspaceId, table.projectId),
    index('agreement_terms_workspace_locked_at_idx').on(table.workspaceId, table.lockedAt),
    check(
      'agreement_terms_commercial_model_check',
      sql`${table.commercialModel} in (${commercialModelSql})`,
    ),
    check('agreement_terms_currency_check', sql`${table.currency} in ('SAR', 'EGP')`),
    check(
      'agreement_terms_disclosure_depth_check',
      sql`${table.disclosureDepth} in (${disclosureDepthSql})`,
    ),
    check(
      'agreement_terms_billing_cycle_check',
      sql`${table.billingCycle} in (${billingCycleSql})`,
    ),
    check(
      'agreement_terms_fee_basis_check',
      sql`${table.feeBasis} is null or ${table.feeBasis} in (${feeBasisSql})`,
    ),
    check(
      'agreement_terms_retention_percentage_check',
      sql`${table.retentionPercentage} >= 0 and ${table.retentionPercentage} <= 100`,
    ),
    check(
      'agreement_terms_basis_points_check',
      sql`(${table.feePercentageBps} is null or (${table.feePercentageBps} >= 0 and ${table.feePercentageBps} <= 10000)) and (${table.savingsSplitContractorBps} is null or (${table.savingsSplitContractorBps} >= 0 and ${table.savingsSplitContractorBps} <= 10000))`,
    ),
    check(
      'agreement_terms_fee_value_shape_check',
      sql`(${table.feeBasis} is null and ${table.feePercentageBps} is null and ${table.feeAmountMinor} is null) or (${table.feeBasis} = 'percentage' and ${table.feePercentageBps} is not null and ${table.feeAmountMinor} is null) or (${table.feeBasis} = 'fixed' and ${table.feeAmountMinor} is not null and ${table.feePercentageBps} is null)`,
    ),
    check(
      'agreement_terms_lump_sum_shape_check',
      sql`${table.commercialModel} <> 'lump_sum' or (${table.contractValueMinor} is not null and ${table.feeBasis} is null and ${table.feePercentageBps} is null and ${table.feeAmountMinor} is null and ${table.targetCostMinor} is null and ${table.gmpCeilingMinor} is null and ${table.savingsSplitContractorBps} is null and ${table.reimbursableCostCategories} is null and ${table.feeAppliesToSubs} is null and ${table.feeAppliesToChangeOrders} is null)`,
    ),
    check(
      'agreement_terms_cost_plus_shape_check',
      sql`${table.commercialModel} <> 'cost_plus' or (${table.contractValueMinor} is null and ${table.feeBasis} is not null and ${table.reimbursableCostCategories} is not null and ${table.feeAppliesToSubs} is not null and ${table.feeAppliesToChangeOrders} is not null and ((${table.gmpCeilingMinor} is null and ${table.savingsSplitContractorBps} is null) or (${table.gmpCeilingMinor} is not null and ${table.savingsSplitContractorBps} is not null)))`,
    ),
    check(
      'agreement_terms_remeasured_shape_check',
      sql`${table.commercialModel} <> 'remeasured' or (${table.feeBasis} is not null and ${table.contractValueMinor} is null and ${table.targetCostMinor} is null and ${table.gmpCeilingMinor} is null and ${table.savingsSplitContractorBps} is null and ${table.reimbursableCostCategories} is null and ${table.feeAppliesToSubs} is null and ${table.feeAppliesToChangeOrders} is null)`,
    ),
  ],
);

export type AgreementTermsRecord = typeof agreementTerms.$inferSelect;
export type NewAgreementTermsRecord = typeof agreementTerms.$inferInsert;
