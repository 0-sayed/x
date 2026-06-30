import { z } from 'zod';

import { sessionWorkspaceSchema } from './session.js';

export const workspaceAccessSchema = z
  .object({
    appInstalled: z.boolean(),
    subscriptionActive: z.boolean(),
    membershipActive: z.boolean(),
  })
  .strict();

export const workspaceMembershipContextSchema = z
  .object({
    userId: z.uuid(),
    roleKey: z.string().trim().min(1).nullable(),
    permissions: z.array(z.string().trim().min(1)),
    isAdmin: z.boolean(),
  })
  .strict();

export const resolvedWorkspaceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).nullable(),
    paymentCurrency: z.string().trim().length(3).nullable(),
  })
  .strict();

export const workspaceContextSchema = z
  .object({
    workspace: resolvedWorkspaceSchema,
    membership: workspaceMembershipContextSchema,
    access: workspaceAccessSchema,
  })
  .strict();

export const workspaceSwitcherResponseSchema = z
  .object({
    activeWorkspaceId: z.uuid().nullable(),
    workspaces: z.array(sessionWorkspaceSchema),
  })
  .strict();

export const switchWorkspaceRequestSchema = z
  .object({
    workspaceId: z.uuid(),
  })
  .strict();

export type WorkspaceAccess = z.infer<typeof workspaceAccessSchema>;
export type WorkspaceMembershipContext = z.infer<typeof workspaceMembershipContextSchema>;
export type ResolvedWorkspace = z.infer<typeof resolvedWorkspaceSchema>;
export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;
export type WorkspaceSwitcherResponse = z.infer<typeof workspaceSwitcherResponseSchema>;
export type SwitchWorkspaceRequest = z.infer<typeof switchWorkspaceRequestSchema>;
