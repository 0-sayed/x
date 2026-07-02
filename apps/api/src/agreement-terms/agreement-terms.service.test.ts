import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AgreementTermsService } from './agreement-terms.service.js';

const workspaceContext = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Acme',
    slug: 'acme',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: null,
    permissions: ['agreement_terms.view', 'agreement_terms.configure'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
} as const;

function createService() {
  const terms = {
    id: '07e3ab28-e188-4b03-a8fc-aec2e4d03243',
    workspaceId: workspaceContext.workspace.id,
    projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
    commercialModel: 'lump_sum',
    currency: 'SAR',
    disclosureDepth: 'category',
    retentionPercentage: 5,
    billingCycle: 'monthly',
    contractValueMinor: 2_500_000,
    feeBasis: null,
    feePercentageBps: null,
    feeAmountMinor: null,
    targetCostMinor: null,
    gmpCeilingMinor: null,
    savingsSplitContractorBps: null,
    reimbursableCostCategories: null,
    feeAppliesToSubs: null,
    feeAppliesToChangeOrders: null,
    contractSnapshotMarkdown: '# Agreement Terms\n',
    contractSnapshotGeneratedAt: new Date('2026-07-02T09:00:00.000Z'),
    lockedAt: null,
    lockedByUserId: null,
    lockedByDrawItemId: null,
    lockReason: null,
    configuredByUserId: workspaceContext.membership.userId,
    createdAt: new Date('2026-07-02T09:00:00.000Z'),
    updatedAt: new Date('2026-07-02T09:00:00.000Z'),
  };
  const repository = {
    findProject: vi.fn().mockResolvedValue({
      id: terms.projectId,
      workspaceId: workspaceContext.workspace.id,
      archivedAt: null,
    }),
    findTerms: vi.fn().mockResolvedValue(terms),
    upsertTerms: vi.fn().mockResolvedValue(terms),
    lockForApprovedDraw: vi.fn().mockResolvedValue({
      ...terms,
      lockedAt: new Date('2026-07-02T10:00:00.000Z'),
      lockedByDrawItemId: '9b2d8796-9258-4381-9330-7b861e073bf8',
      lockReason: 'first_draw_item_approved',
    }),
  };
  const auditService = { recordEvent: vi.fn().mockResolvedValue(undefined) };

  return {
    terms,
    repository,
    auditService,
    service: new AgreementTermsService(repository as never, auditService as never),
  };
}

describe('AgreementTermsService', () => {
  it('returns nullable terms for existing projects', async () => {
    const { service, repository, terms } = createService();
    repository.findTerms.mockResolvedValueOnce(undefined);

    await expect(
      service.getAgreementTerms(workspaceContext as never, terms.projectId),
    ).resolves.toEqual({
      terms: null,
    });
  });

  it('rejects missing projects', async () => {
    const { service, repository, terms } = createService();
    repository.findProject.mockResolvedValue(undefined);

    await expect(
      service.getAgreementTerms(workspaceContext as never, terms.projectId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects invalid configure requests before repository writes', async () => {
    const { service, repository, terms } = createService();

    await expect(
      service.configureAgreementTerms(workspaceContext as never, terms.projectId, {
        commercialModel: 'gmp',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.upsertTerms).not.toHaveBeenCalled();
  });

  it('rejects configuration on archived projects', async () => {
    const { service, repository, terms } = createService();
    repository.findProject.mockResolvedValue({
      id: terms.projectId,
      workspaceId: workspaceContext.workspace.id,
      archivedAt: new Date('2026-07-02T09:00:00.000Z'),
    });

    await expect(
      service.configureAgreementTerms(workspaceContext as never, terms.projectId, {
        commercialModel: 'lump_sum',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        contractValueMinor: 2_500_000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects configuration after terms are locked', async () => {
    const { service, repository, terms } = createService();
    repository.findTerms.mockResolvedValue({
      ...terms,
      lockedAt: new Date('2026-07-02T10:00:00.000Z'),
    });

    await expect(
      service.configureAgreementTerms(workspaceContext as never, terms.projectId, {
        commercialModel: 'lump_sum',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        contractValueMinor: 2_500_000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('configures terms, generates a contract snapshot, and records audit', async () => {
    const { service, repository, auditService, terms } = createService();

    await expect(
      service.configureAgreementTerms(workspaceContext as never, terms.projectId, {
        commercialModel: 'lump_sum',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        contractValueMinor: 2_500_000,
      }),
    ).resolves.toEqual({
      terms: expect.objectContaining({
        commercialModel: 'lump_sum',
        contractSnapshotMarkdown: '# Agreement Terms\n',
      }),
    });

    expect(repository.upsertTerms).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: workspaceContext.workspace.id,
        projectId: terms.projectId,
        configuredByUserId: workspaceContext.membership.userId,
        contractSnapshotMarkdown: expect.stringContaining('# Agreement Terms'),
      }),
    );
    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
        action: 'agreement_terms.configured',
        resourceType: 'agreement_terms',
        resourceId: terms.id,
      }),
    );
  });

  it('rejects configuration when a concurrent lock skips the upsert update', async () => {
    const { service, repository, auditService, terms } = createService();
    repository.findTerms.mockResolvedValueOnce(null);
    repository.upsertTerms.mockResolvedValueOnce(undefined);

    await expect(
      service.configureAgreementTerms(workspaceContext as never, terms.projectId, {
        commercialModel: 'lump_sum',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        contractValueMinor: 2_500_000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(auditService.recordEvent).not.toHaveBeenCalled();
  });

  it('locks terms for approved draw items and records audit', async () => {
    const { service, auditService, terms } = createService();

    await expect(
      service.lockForApprovedDraw({
        workspaceId: workspaceContext.workspace.id,
        projectId: terms.projectId,
        drawItemId: '9b2d8796-9258-4381-9330-7b861e073bf8',
        lockedByUserId: null,
      }),
    ).resolves.toEqual(expect.objectContaining({ lockReason: 'first_draw_item_approved' }));

    expect(auditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'internal',
        action: 'agreement_terms.locked',
        resourceType: 'agreement_terms',
        resourceId: terms.id,
      }),
    );
  });
});
