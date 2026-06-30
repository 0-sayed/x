import { z } from 'zod';

export const sessionWorkspaceSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).nullable(),
    roleKey: z.string().trim().min(1).nullable(),
    permissions: z.array(z.string().trim().min(1)),
    isAdmin: z.boolean(),
  })
  .strict();

export const currentSessionUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().trim().min(1).nullable(),
    phone: z.string().trim().min(1).nullable(),
    avatarUrl: z.url().nullable(),
    activeWorkspaceId: z.uuid().nullable(),
    workspaces: z.array(sessionWorkspaceSchema),
  })
  .strict();

export type SessionWorkspace = z.infer<typeof sessionWorkspaceSchema>;
export type CurrentSessionUser = z.infer<typeof currentSessionUserSchema>;
