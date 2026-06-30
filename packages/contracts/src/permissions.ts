import { z } from 'zod';

export const permissionKeys = [
  'workspace.view',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.archive',
  'agreement_terms.view',
  'agreement_terms.configure',
  'schedule.view',
  'schedule.manage',
  'schedule.propose_baseline',
  'milestones.complete',
  'draws.view',
  'draws.create',
  'draws.submit',
  'draws.release',
  'draws.release_retention',
  'payables.view',
  'payables.create',
  'payables.pay',
  'continuity.view',
  'continuity.pause',
  'budget.view',
  'budget.manage',
  'budget.set_audience',
  'materials.view',
  'materials.create',
  'materials.edit',
  'materials.receive',
  'materials.use',
  'materials.manage_po',
  'suggestions.view',
  'suggestions.resolve',
  'subcontractors.view',
  'subcontractors.create',
  'subcontractors.edit',
  'subcontractors.manage_compliance',
  'submittals.view',
  'submittals.create',
  'submittals.review',
  'submittals.approve',
  'variations.view',
  'variations.create',
  'variations.approve',
  'documents.view',
  'documents.create',
  'documents.send_for_signature',
  'documents.void',
  'manage_documents',
  'certificates.view',
  'certificates.generate',
  'signoffs.view',
  'snags.view',
  'snags.create',
  'snags.assign',
  'snags.fix',
  'manage_snags',
  'people.view',
  'roles.view',
  'roles.create',
  'roles.edit',
  'manage_roles',
  'user_role_assignments.manage',
  'branding.view',
  'branding.manage',
  'settings.view',
  'settings.manage_defaults',
  'audit.view',
  'search.use',
] as const;

export const permissionKeySchema = z.enum(permissionKeys);
export const permissionCatalogSchema = z.array(permissionKeySchema);

export type PermissionKey = z.infer<typeof permissionKeySchema>;

const permissionKeySet = new Set<string>(permissionKeys);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionKeySet.has(value);
}

export const systemRoleKeySchema = z.enum([
  'workspaceAdmin',
  'projectManager',
  'finance',
  'viewer',
]);

export const roleNameSchema = z.string().trim().min(1).max(120);

export const rolePermissionListSchema = z
  .array(permissionKeySchema)
  .min(1)
  .refine((permissions) => new Set(permissions).size === permissions.length, {
    message: 'Permission keys must be unique',
  });

export const roleSummarySchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    systemKey: systemRoleKeySchema.nullable(),
    isSystem: z.boolean(),
    nameEn: roleNameSchema,
    nameAr: roleNameSchema,
    permissions: rolePermissionListSchema,
    clonedFromRoleId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const createRoleRequestSchema = z
  .object({
    nameEn: roleNameSchema,
    nameAr: roleNameSchema,
    permissions: rolePermissionListSchema,
  })
  .strict();

export const updateRoleRequestSchema = z
  .object({
    nameEn: roleNameSchema.optional(),
    nameAr: roleNameSchema.optional(),
    permissions: rolePermissionListSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one role field is required',
  });

export const cloneRoleRequestSchema = z
  .object({
    nameEn: roleNameSchema,
    nameAr: roleNameSchema,
  })
  .strict();

export const replaceUserRoleAssignmentsRequestSchema = z
  .object({
    userId: z.uuid(),
    roleIds: z
      .array(z.uuid())
      .min(1)
      .refine((roleIds) => new Set(roleIds).size === roleIds.length, {
        message: 'Role ids must be unique',
      }),
  })
  .strict();

export const rolesResponseSchema = z
  .object({
    roles: z.array(roleSummarySchema),
  })
  .strict();

export const userRoleAssignmentSummarySchema = z
  .object({
    workspaceId: z.uuid(),
    userId: z.uuid(),
    roleIds: z.array(z.uuid()),
    permissions: rolePermissionListSchema,
  })
  .strict();

export type SystemRoleKey = z.infer<typeof systemRoleKeySchema>;
export type RoleSummary = z.infer<typeof roleSummarySchema>;
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type CloneRoleRequest = z.infer<typeof cloneRoleRequestSchema>;
export type ReplaceUserRoleAssignmentsRequest = z.infer<
  typeof replaceUserRoleAssignmentsRequestSchema
>;
export type RolesResponse = z.infer<typeof rolesResponseSchema>;
export type UserRoleAssignmentSummary = z.infer<typeof userRoleAssignmentSummarySchema>;
