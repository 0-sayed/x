import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
  RoleSummary,
  RolesResponse,
  UserRoleAssignmentSummary,
  WorkspaceContext as WorkspaceContextValue,
} from '@materiabill/contracts';
import {
  cloneRoleRequestSchema,
  createRoleRequestSchema,
  replaceUserRoleAssignmentsRequestSchema,
  updateRoleRequestSchema,
} from '@materiabill/contracts';

import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { RequirePermissions } from './permissions.decorator.js';
import { PermissionsGuard } from './permissions.guard.js';
import { PermissionsService } from './permissions.service.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const permissionsGuard = new PermissionsGuard(new Reflector());

@Controller()
export class PermissionsController {
  constructor(
    @Inject(PermissionsService)
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('permissions/catalog')
  @UseGuards(WorkspaceContextGuard)
  catalog() {
    return this.permissionsService.getCatalog();
  }

  @Get('roles')
  @UseGuards(WorkspaceContextGuard, permissionsGuard)
  @RequirePermissions('roles.view')
  roles(@WorkspaceContext() workspaceContext: WorkspaceContextValue): Promise<RolesResponse> {
    return this.permissionsService.listRoles(workspaceContext.workspace.id);
  }

  @Post('roles')
  @UseGuards(WorkspaceContextGuard, permissionsGuard)
  @RequirePermissions('manage_roles')
  createRole(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Body() body: unknown,
  ): Promise<RoleSummary> {
    assertValidBody(createRoleRequestSchema, body, 'Invalid role create request');

    return this.permissionsService.createRole(workspaceContext.workspace.id, body);
  }

  @Patch('roles/:roleId')
  @UseGuards(WorkspaceContextGuard, permissionsGuard)
  @RequirePermissions('manage_roles')
  updateRole(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ): Promise<RoleSummary> {
    assertValidBody(updateRoleRequestSchema, body, 'Invalid role update request');

    return this.permissionsService.updateRole(
      workspaceContext.workspace.id,
      parseRoleId(roleId),
      body,
    );
  }

  @Post('roles/:roleId/clone')
  @UseGuards(WorkspaceContextGuard, permissionsGuard)
  @RequirePermissions('manage_roles')
  cloneRole(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Param('roleId') roleId: string,
    @Body() body: unknown,
  ): Promise<RoleSummary> {
    assertValidBody(cloneRoleRequestSchema, body, 'Invalid role clone request');

    return this.permissionsService.cloneRole(
      workspaceContext.workspace.id,
      parseRoleId(roleId),
      body,
    );
  }

  @Post('user-role-assignments')
  @UseGuards(WorkspaceContextGuard, permissionsGuard)
  @RequirePermissions('manage_roles')
  replaceUserRoleAssignments(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Body() body: unknown,
  ): Promise<UserRoleAssignmentSummary> {
    assertValidBody(
      replaceUserRoleAssignmentsRequestSchema,
      body,
      'Invalid user role assignment request',
    );

    return this.permissionsService.replaceUserRoleAssignments(workspaceContext.workspace.id, body);
  }
}

function parseRoleId(roleId: string): string {
  if (!uuidPattern.test(roleId)) {
    throw new BadRequestException('Invalid role id');
  }

  return roleId;
}

function assertValidBody(
  schema: {
    safeParse: (body: unknown) => { success: boolean };
  },
  body: unknown,
  message: string,
): void {
  if (!schema.safeParse(body).success) {
    throw new BadRequestException(message);
  }
}
