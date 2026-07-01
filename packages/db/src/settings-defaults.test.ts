import { describe, expect, it, vi } from 'vitest';

import {
  buildWorkspaceSettingsDefaults,
  defaultNotificationPreferences,
  seedWorkspaceSettingsDefaults,
} from './settings-defaults.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';

describe('settings defaults', () => {
  it('builds the seed row from Materiabill workspace defaults', () => {
    expect(buildWorkspaceSettingsDefaults(workspaceId)).toEqual({
      workspaceId,
      currency: 'SAR',
      timezone: 'Asia/Riyadh',
      defaultLanguage: 'en',
      defaultRetentionPercentage: 5,
      graceWindowMinutes: 10,
      defaultDisclosureDepth: 'none',
      suggestionThrottlePerMaterial: 5,
      inviteAutoNudgeHours: 48,
      notificationPreferences: defaultNotificationPreferences,
    });
  });

  it('does not write when no workspace ids are provided', async () => {
    const db = { insert: vi.fn() };

    await seedWorkspaceSettingsDefaults(db, []);

    expect(db.insert).not.toHaveBeenCalled();
  });
});
