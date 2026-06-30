import { describe, expect, it } from 'vitest';

import { currentSessionUserSchema } from './session.js';

describe('session contracts', () => {
  it('accepts the /user response payload', () => {
    const parsed = currentSessionUserSchema.parse({
      id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      email: 'admin@example.com',
      displayName: 'Admin User',
      phone: null,
      avatarUrl: null,
      activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      workspaces: [
        {
          id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
          name: 'Demo Workspace',
          slug: 'demo-workspace',
          roleKey: 'workspace_admin',
          permissions: ['workspace.view'],
          isAdmin: true,
        },
      ],
    });

    expect(parsed.workspaces[0]?.permissions).toEqual(['workspace.view']);
  });

  it('rejects token-shaped data in the /user response', () => {
    expect(() =>
      currentSessionUserSchema.parse({
        id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        email: 'admin@example.com',
        displayName: 'Admin User',
        phone: null,
        avatarUrl: null,
        activeWorkspaceId: null,
        accessToken: 'must-not-leak',
        workspaces: [],
      }),
    ).toThrow();
  });
});
