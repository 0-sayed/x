import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import { projectIdSchema } from '@materiabill/contracts';

import { RequirePermissions } from '../permissions/permissions.decorator.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { AgreementTermsService } from './agreement-terms.service.js';

@Controller('projects/:projectId/agreement-terms')
@UseGuards(WorkspaceContextGuard, PermissionsGuard)
export class AgreementTermsController {
  constructor(
    @Inject(AgreementTermsService)
    private readonly agreementTermsService: AgreementTermsService,
  ) {}

  @Get()
  @RequirePermissions('agreement_terms.view')
  getAgreementTerms(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
  ) {
    return this.agreementTermsService.getAgreementTerms(
      workspaceContext,
      parseProjectId(projectId),
    );
  }

  @Put()
  @RequirePermissions('agreement_terms.configure')
  configureAgreementTerms(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('projectId') projectId: string,
    @Body() body: unknown,
  ) {
    return this.agreementTermsService.configureAgreementTerms(
      workspaceContext,
      parseProjectId(projectId),
      body,
    );
  }
}

function parseProjectId(projectId: string): string {
  const parsed = projectIdSchema.safeParse(projectId);
  if (!parsed.success) {
    throw new BadRequestException('Invalid project id');
  }
  return parsed.data;
}
