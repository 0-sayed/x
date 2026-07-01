import { describe, expect, it, vi } from 'vitest';

import { SettingsRepository } from './settings.repository.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';

function createDbMock() {
  const state = {
    insertedRows: [] as unknown[],
    updatedRows: [] as unknown[],
    selectedRow: {
      workspaceId,
      currency: 'SAR',
      timezone: 'Asia/Riyadh',
      defaultLanguage: 'en',
      defaultRetentionPercentage: 5,
      graceWindowMinutes: 10,
      defaultDisclosureDepth: 'none',
      suggestionThrottlePerMaterial: 5,
      inviteAutoNudgeHours: 48,
      notificationPreferences: {
        default: { inApp: true, email: true, whatsapp: false },
      },
      createdAt: new Date('2026-07-01T09:00:00.000Z'),
      updatedAt: new Date('2026-07-01T09:00:00.000Z'),
    },
  };

  const db = {
    insert: vi.fn(() => ({
      values: (rows: unknown[]) => ({
        onConflictDoNothing: vi.fn(() => {
          state.insertedRows.push(...rows);
          return Promise.resolve();
        }),
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([state.selectedRow]),
        }),
      }),
    })),
    update: vi.fn(() => ({
      set: (row: unknown) => ({
        where: () => ({
          returning: () => {
            state.updatedRows.push(row);
            return Promise.resolve([{ ...state.selectedRow, ...(row as object) }]);
          },
        }),
      }),
    })),
  };

  return Object.assign(db, state);
}

describe('SettingsRepository', () => {
  it('seeds defaults before reading a workspace settings row', async () => {
    const db = createDbMock();
    const repository = new SettingsRepository({ db } as never);

    await expect(repository.getOrSeedWorkspaceSettings(workspaceId)).resolves.toMatchObject({
      workspaceId,
      graceWindowMinutes: 10,
    });
    expect(db.insertedRows).toHaveLength(1);
    expect(db.insertedRows[0]).toMatchObject({ workspaceId, graceWindowMinutes: 10 });
  });

  it('seeds before applying an update and returns the updated row', async () => {
    const db = createDbMock();
    const repository = new SettingsRepository({ db } as never);

    await expect(
      repository.updateWorkspaceSettings(workspaceId, { graceWindowMinutes: 15 }),
    ).resolves.toMatchObject({ workspaceId, graceWindowMinutes: 15 });
    expect(db.insertedRows).toHaveLength(1);
    expect(db.updatedRows[0]).toMatchObject({
      graceWindowMinutes: 15,
      updatedAt: expect.any(Date),
    });
  });
});
