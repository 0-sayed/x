import { seedWorkspaceSettingsDefaults } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { ProjectionUpsertService } from '../../src/inframodern-sync/projection-upsert.service.js';

vi.mock('@materiabill/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@materiabill/db')>();
  return {
    ...actual,
    seedWorkspaceSettingsDefaults: vi.fn().mockResolvedValue(undefined),
  };
});

function createDbMock() {
  return {
    insert: vi.fn(() => ({
      values: () => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      }),
    })),
  };
}

describe('ProjectionUpsertService settings seeding', () => {
  it('seeds workspace settings after user workspace projections', async () => {
    const db = createDbMock();
    const service = new ProjectionUpsertService(db as never);

    await expect(
      service.upsert('users', [
        {
          id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
          email: 'admin@example.com',
          workspaces: [
            {
              id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
              name: 'Demo Workspace',
            },
          ],
        },
      ]),
    ).resolves.toBe(1);

    expect(seedWorkspaceSettingsDefaults).toHaveBeenCalledWith(db, [
      '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    ]);
  });
});
