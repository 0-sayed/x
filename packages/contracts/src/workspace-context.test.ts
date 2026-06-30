import { describe, expect, it } from 'vitest';

import {
  switchWorkspaceRequestSchema,
  workspaceContextSchema,
  workspaceSwitcherResponseSchema,
} from './workspace-context.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const userId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

describe('workspace context contracts', () => {
  it('validates the resolved workspace context response', () => {
    expect(
      workspaceContextSchema.parse({
        workspace: {
          id: workspaceId,
          name: 'Demo Workspace',
          slug: 'demo-workspace',
          paymentCurrency: 'SAR',
        },
        membership: {
          userId,
          roleKey: 'workspace_admin',
          permissions: ['workspace.view'],
          isAdmin: true,
        },
        access: {
          appInstalled: true,
          subscriptionActive: true,
          membershipActive: true,
        },
      }),
    ).toEqual({
      workspace: {
        id: workspaceId,
        name: 'Demo Workspace',
        slug: 'demo-workspace',
        paymentCurrency: 'SAR',
      },
      membership: {
        userId,
        roleKey: 'workspace_admin',
        permissions: ['workspace.view'],
        isAdmin: true,
      },
      access: {
        appInstalled: true,
        subscriptionActive: true,
        membershipActive: true,
      },
    });
  });

  it('validates switcher responses and switch requests', () => {
    expect(
      workspaceSwitcherResponseSchema.parse({
        activeWorkspaceId: workspaceId,
        workspaces: [
          {
            id: workspaceId,
            name: 'Demo Workspace',
            slug: 'demo-workspace',
            roleKey: 'workspace_admin',
            permissions: ['workspace.view'],
            isAdmin: true,
          },
        ],
      }).activeWorkspaceId,
    ).toBe(workspaceId);

    expect(switchWorkspaceRequestSchema.parse({ workspaceId })).toEqual({ workspaceId });
  });

  it('rejects malformed workspace payment currencies', () => {
    expect(() =>
      workspaceContextSchema.parse({
        workspace: {
          id: workspaceId,
          name: 'Demo Workspace',
          slug: 'demo-workspace',
          paymentCurrency: 'usd',
        },
        membership: {
          userId,
          roleKey: 'workspace_admin',
          permissions: ['workspace.view'],
          isAdmin: true,
        },
        access: {
          appInstalled: true,
          subscriptionActive: true,
          membershipActive: true,
        },
      }),
    ).toThrow();
  });

  it('rejects malformed workspace ids', () => {
    expect(() => switchWorkspaceRequestSchema.parse({ workspaceId: 'not-a-uuid' })).toThrow();
  });
});
