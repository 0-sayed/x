import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  cloneRoleRequestSchema,
  createRoleRequestSchema,
  replaceUserRoleAssignmentsRequestSchema,
  updateRoleRequestSchema,
  type RoleSummary,
  type RolesResponse,
  type UserRoleAssignmentSummary,
} from '@materiabill/contracts';
import {
  buildPermissionCatalogResponse,
  type PermissionCatalogResponse,
} from '@materiabill/permissions';

import { PermissionsRepository } from './permissions.repository.js';

@Injectable()
export class PermissionsService {
  constructor(
    @Inject(PermissionsRepository)
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  getCatalog(): PermissionCatalogResponse {
    return buildPermissionCatalogResponse();
  }

  async listRoles(workspaceId: string): Promise<RolesResponse> {
    const roles = await this.permissionsRepository.findWorkspaceRoles(workspaceId);

    return { roles: roles.map(toRoleSummary) };
  }

  async createRole(workspaceId: string, body: unknown): Promise<RoleSummary> {
    const parsedBody = parseRequest(createRoleRequestSchema, body, 'Invalid role create request');

    return this.permissionsRepository.createRole({ workspaceId, ...parsedBody });
  }

  async updateRole(workspaceId: string, roleId: string, body: unknown): Promise<RoleSummary> {
    const parsedBody = parseRequest(updateRoleRequestSchema, body, 'Invalid role update request');
    const role = await this.permissionsRepository.updateRole({
      workspaceId,
      roleId,
      ...parsedBody,
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async cloneRole(workspaceId: string, roleId: string, body: unknown): Promise<RoleSummary> {
    const parsedBody = parseRequest(cloneRoleRequestSchema, body, 'Invalid role clone request');
    const role = await this.permissionsRepository.cloneRole({
      workspaceId,
      sourceRoleId: roleId,
      ...parsedBody,
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async replaceUserRoleAssignments(
    workspaceId: string,
    body: unknown,
  ): Promise<UserRoleAssignmentSummary> {
    const parsedBody = parseRequest(
      replaceUserRoleAssignmentsRequestSchema,
      body,
      'Invalid user role assignment request',
    );

    await this.permissionsRepository.replaceUserRoleAssignments({
      workspaceId,
      userId: parsedBody.userId,
      roleIds: parsedBody.roleIds,
    });

    return {
      workspaceId,
      userId: parsedBody.userId,
      roleIds: [...parsedBody.roleIds],
      permissions: [
        ...(await this.permissionsRepository.findEffectivePermissions(
          workspaceId,
          parsedBody.userId,
        )),
      ],
    };
  }
}

type RequestSchema<T> = {
  safeParse: (body: unknown) => { success: true; data: T } | { success: false };
};

function parseRequest<T>(schema: RequestSchema<T>, body: unknown, message: string): T {
  const parsedBody = schema.safeParse(body);
  if (!parsedBody.success) {
    throw new BadRequestException(message);
  }

  return parsedBody.data;
}

function toRoleSummary(role: RoleSummary): RoleSummary {
  return {
    ...role,
    permissions: [...role.permissions],
  };
}
