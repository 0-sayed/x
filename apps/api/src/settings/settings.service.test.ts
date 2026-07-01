import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SettingsService } from './settings.service.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';

const settingsRecord = {
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
} as const;

function createRepositoryMock() {
  return {
    getOrSeedWorkspaceSettings: vi.fn().mockResolvedValue(settingsRecord),
    updateWorkspaceSettings: vi.fn().mockResolvedValue({
      ...settingsRecord,
      graceWindowMinutes: 15,
    }),
  };
}

describe('SettingsService', () => {
  it('returns parsed workspace settings responses', async () => {
    const repository = createRepositoryMock();
    const service = new SettingsService(repository as never);

    await expect(service.getWorkspaceSettings(workspaceId)).resolves.toEqual({
      settings: {
        ...settingsRecord,
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
      },
    });
  });

  it('validates update requests before calling the repository', async () => {
    const repository = createRepositoryMock();
    const service = new SettingsService(repository as never);

    await expect(service.updateWorkspaceSettings(workspaceId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(repository.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it('updates provided settings and exposes grace minutes for consumers', async () => {
    const repository = createRepositoryMock();
    const service = new SettingsService(repository as never);

    await expect(
      service.updateWorkspaceSettings(workspaceId, { graceWindowMinutes: '15' }),
    ).resolves.toMatchObject({
      settings: { graceWindowMinutes: 15 },
    });
    await expect(service.getGraceWindowMinutes(workspaceId)).resolves.toBe(10);

    expect(repository.updateWorkspaceSettings).toHaveBeenCalledWith(workspaceId, {
      graceWindowMinutes: 15,
    });
  });
});
