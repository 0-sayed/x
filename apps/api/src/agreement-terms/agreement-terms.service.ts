import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  agreementTermsResponseSchema,
  agreementTermsSchema,
  configureAgreementTermsRequestSchema,
  type AgreementTerms,
  type AgreementTermsResponse,
  type ConfigureAgreementTermsRequest,
  type WorkspaceContext,
} from '@materiabill/contracts';
import type { AgreementTermsRecord } from '@materiabill/db';

import { AuditService } from '../audit/audit.service.js';
import { renderAgreementContractSnapshot } from './agreement-contract.renderer.js';
import { AgreementTermsRepository } from './agreement-terms.repository.js';

type LockForApprovedDrawInput = {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly drawItemId: string;
  readonly lockedByUserId: string | null;
};

@Injectable()
export class AgreementTermsService {
  constructor(
    @Inject(AgreementTermsRepository)
    private readonly agreementTermsRepository: AgreementTermsRepository,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  async getAgreementTerms(
    workspaceContext: WorkspaceContext,
    projectId: string,
  ): Promise<AgreementTermsResponse> {
    await this.requireProject(workspaceContext.workspace.id, projectId);
    const terms = await this.agreementTermsRepository.findTerms({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });

    return agreementTermsResponseSchema.parse({
      terms: terms ? this.toAgreementTerms(terms) : null,
    });
  }

  async configureAgreementTerms(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<AgreementTermsResponse> {
    const parsed = parseConfigureRequest(body);
    const project = await this.requireProject(workspaceContext.workspace.id, projectId);
    if (project.archivedAt) {
      throw new ConflictException('Archived project agreement terms cannot be configured');
    }

    const current = await this.agreementTermsRepository.findTerms({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    if (current?.lockedAt) {
      throw new ConflictException('Agreement terms are locked');
    }

    const snapshotInput = this.toSnapshotInput(projectId, parsed);
    const terms = await this.agreementTermsRepository.upsertTerms({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      ...parsed,
      contractSnapshotMarkdown: renderAgreementContractSnapshot(snapshotInput),
      contractSnapshotGeneratedAt: new Date(),
      configuredByUserId: workspaceContext.membership.userId,
    });

    await this.auditService.recordEvent({
      workspaceId: workspaceContext.workspace.id,
      actorUserId: workspaceContext.membership.userId,
      audience: 'internal',
      action: 'agreement_terms.configured',
      resourceType: 'agreement_terms',
      resourceId: terms.id,
      metadata: { projectId, commercialModel: terms.commercialModel },
    });

    return agreementTermsResponseSchema.parse({ terms: this.toAgreementTerms(terms) });
  }

  async lockForApprovedDraw(input: LockForApprovedDrawInput): Promise<AgreementTerms> {
    const existing = await this.agreementTermsRepository.findTerms(input);
    if (!existing) {
      throw new ConflictException('Agreement terms must be configured before draw approval');
    }
    if (existing.lockedAt) {
      return this.toAgreementTerms(existing);
    }

    const locked = await this.agreementTermsRepository.lockForApprovedDraw({
      ...input,
      lockedAt: new Date(),
    });
    if (!locked) {
      const current = await this.agreementTermsRepository.findTerms(input);
      if (current?.lockedAt) {
        return this.toAgreementTerms(current);
      }
      throw new ConflictException('Agreement terms must be configured before draw approval');
    }

    await this.auditService.recordEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.lockedByUserId,
      audience: 'internal',
      action: 'agreement_terms.locked',
      resourceType: 'agreement_terms',
      resourceId: locked.id,
      metadata: { projectId: input.projectId, drawItemId: input.drawItemId },
    });

    return this.toAgreementTerms(locked);
  }

  private async requireProject(workspaceId: string, projectId: string) {
    const project = await this.agreementTermsRepository.findProject({ workspaceId, projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private toSnapshotInput(projectId: string, input: ConfigureAgreementTermsRequest) {
    return {
      projectId,
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
    };
  }

  private toAgreementTerms(record: AgreementTermsRecord): AgreementTerms {
    return agreementTermsSchema.parse({
      id: record.id,
      workspaceId: record.workspaceId,
      projectId: record.projectId,
      commercialModel: record.commercialModel,
      currency: record.currency,
      disclosureDepth: record.disclosureDepth,
      retentionPercentage: record.retentionPercentage,
      billingCycle: record.billingCycle,
      contractValueMinor: record.contractValueMinor,
      feeBasis: record.feeBasis,
      feePercentageBps: record.feePercentageBps,
      feeAmountMinor: record.feeAmountMinor,
      targetCostMinor: record.targetCostMinor,
      gmpCeilingMinor: record.gmpCeilingMinor,
      savingsSplitContractorBps: record.savingsSplitContractorBps,
      reimbursableCostCategories: record.reimbursableCostCategories,
      feeAppliesToSubs: record.feeAppliesToSubs,
      feeAppliesToChangeOrders: record.feeAppliesToChangeOrders,
      contractSnapshotMarkdown: record.contractSnapshotMarkdown,
      contractSnapshotGeneratedAt: record.contractSnapshotGeneratedAt.toISOString(),
      lockedAt: record.lockedAt?.toISOString() ?? null,
      lockedByUserId: record.lockedByUserId,
      lockedByDrawItemId: record.lockedByDrawItemId,
      lockReason: record.lockReason,
      configuredByUserId: record.configuredByUserId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }
}

function parseConfigureRequest(body: unknown): ConfigureAgreementTermsRequest {
  const parsed = configureAgreementTermsRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException('Invalid agreement terms request');
  }
  return parsed.data;
}
