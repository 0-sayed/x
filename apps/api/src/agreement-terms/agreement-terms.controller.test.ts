import 'reflect-metadata';

import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { AgreementTermsController } from './agreement-terms.controller.js';

const workspaceContext = {
  workspace: { id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a' },
  membership: { userId: '3f43835d-7f3b-4b16-907b-d57db49832dd' },
} as never;

describe('AgreementTermsController', () => {
  it('registers guards by class for Nest dependency injection', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AgreementTermsController)).toEqual([
      WorkspaceContextGuard,
      PermissionsGuard,
    ]);
  });

  it('delegates GET requests with a parsed project id', async () => {
    const service = {
      getAgreementTerms: vi.fn().mockResolvedValue({ terms: null }),
      configureAgreementTerms: vi.fn(),
    };
    const controller = new AgreementTermsController(service as never);

    await expect(
      controller.getAgreementTerms(workspaceContext, 'c5d9ed84-6469-4889-995d-cd38994fb7dd'),
    ).resolves.toEqual({ terms: null });

    expect(service.getAgreementTerms).toHaveBeenCalledWith(
      workspaceContext,
      'c5d9ed84-6469-4889-995d-cd38994fb7dd',
    );
  });

  it('delegates PUT requests with a parsed project id and body', async () => {
    const body = {
      commercialModel: 'lump_sum',
      currency: 'SAR',
      disclosureDepth: 'category',
      retentionPercentage: 5,
      billingCycle: 'monthly',
      contractValueMinor: 2_500_000,
    };
    const service = {
      getAgreementTerms: vi.fn(),
      configureAgreementTerms: vi.fn().mockResolvedValue({ terms: null }),
    };
    const controller = new AgreementTermsController(service as never);

    await expect(
      controller.configureAgreementTerms(
        workspaceContext,
        'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        body,
      ),
    ).resolves.toEqual({ terms: null });

    expect(service.configureAgreementTerms).toHaveBeenCalledWith(
      workspaceContext,
      'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      body,
    );
  });

  it('rejects invalid project ids', () => {
    const controller = new AgreementTermsController({
      getAgreementTerms: vi.fn(),
      configureAgreementTerms: vi.fn(),
    } as never);

    expect(() => controller.getAgreementTerms(workspaceContext, 'not-a-uuid')).toThrow(
      BadRequestException,
    );
  });
});
