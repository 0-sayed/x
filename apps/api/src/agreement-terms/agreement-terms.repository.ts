import { Inject, Injectable } from '@nestjs/common';
import {
  agreementTerms,
  projects,
  type AgreementTermsRecord,
  type DatabaseClient,
} from '@materiabill/db';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  LockAgreementTermsInput,
  ProjectIdentityInput,
  ProjectTermsEligibility,
  UpsertAgreementTermsInput,
} from './agreement-terms.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class AgreementTermsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async findProject(input: ProjectIdentityInput): Promise<ProjectTermsEligibility | undefined> {
    const rows = await this.#db
      .select({
        id: projects.id,
        workspaceId: projects.workspaceId,
        archivedAt: projects.archivedAt,
      })
      .from(projects)
      .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
      .limit(1);

    return rows[0];
  }

  async findTerms(input: ProjectIdentityInput): Promise<AgreementTermsRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(agreementTerms)
      .where(
        and(
          eq(agreementTerms.workspaceId, input.workspaceId),
          eq(agreementTerms.projectId, input.projectId),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async upsertTerms(input: UpsertAgreementTermsInput): Promise<AgreementTermsRecord | undefined> {
    const record = toRecord(input);
    const rows = await this.#db
      .insert(agreementTerms)
      .values(record)
      .onConflictDoUpdate({
        target: [agreementTerms.workspaceId, agreementTerms.projectId],
        set: {
          ...record,
          updatedAt: new Date(),
        },
        setWhere: isNull(agreementTerms.lockedAt),
      })
      .returning();

    return rows[0];
  }

  async lockForApprovedDraw(
    input: LockAgreementTermsInput,
  ): Promise<AgreementTermsRecord | undefined> {
    const rows = await this.#db
      .update(agreementTerms)
      .set({
        lockedAt: input.lockedAt,
        lockedByUserId: input.lockedByUserId,
        lockedByDrawItemId: input.drawItemId,
        lockReason: 'first_draw_item_approved',
        updatedAt: input.lockedAt,
      })
      .where(
        and(
          eq(agreementTerms.workspaceId, input.workspaceId),
          eq(agreementTerms.projectId, input.projectId),
          isNull(agreementTerms.lockedAt),
        ),
      )
      .returning();

    return rows[0];
  }
}

function toRecord(input: UpsertAgreementTermsInput) {
  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    commercialModel: input.commercialModel,
    currency: input.currency,
    disclosureDepth: input.disclosureDepth,
    retentionPercentage: input.retentionPercentage,
    billingCycle: input.billingCycle,
    contractValueMinor: 'contractValueMinor' in input ? input.contractValueMinor : null,
    feeBasis: 'feeBasis' in input ? input.feeBasis : null,
    feePercentageBps: 'feePercentageBps' in input ? (input.feePercentageBps ?? null) : null,
    feeAmountMinor: 'feeAmountMinor' in input ? (input.feeAmountMinor ?? null) : null,
    targetCostMinor: 'targetCostMinor' in input ? (input.targetCostMinor ?? null) : null,
    gmpCeilingMinor: 'gmpCeilingMinor' in input ? (input.gmpCeilingMinor ?? null) : null,
    savingsSplitContractorBps:
      'savingsSplitContractorBps' in input ? (input.savingsSplitContractorBps ?? null) : null,
    reimbursableCostCategories:
      'reimbursableCostCategories' in input ? input.reimbursableCostCategories : null,
    feeAppliesToSubs: 'feeAppliesToSubs' in input ? input.feeAppliesToSubs : null,
    feeAppliesToChangeOrders:
      'feeAppliesToChangeOrders' in input ? input.feeAppliesToChangeOrders : null,
    contractSnapshotMarkdown: input.contractSnapshotMarkdown,
    contractSnapshotGeneratedAt: input.contractSnapshotGeneratedAt,
    configuredByUserId: input.configuredByUserId,
  };
}
