import { describe, expect, it } from 'vitest';

import {
  updateWorkspaceSettingsRequestSchema,
  workspaceSettingsResponseSchema,
  workspaceSettingsSchema,
} from './settings.js';

const settingsPayload = {
  workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
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
    contractorInviteAutoNudge: { inApp: true, email: true, whatsapp: false },
  },
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T09:00:00.000Z',
} as const;

describe('settings contracts', () => {
  it('accepts workspace settings responses with launch notification channels', () => {
    expect(workspaceSettingsResponseSchema.parse({ settings: settingsPayload })).toEqual({
      settings: settingsPayload,
    });
  });

  it('accepts strict partial update requests', () => {
    expect(
      updateWorkspaceSettingsRequestSchema.parse({
        defaultRetentionPercentage: 7,
        graceWindowMinutes: '15',
        defaultDisclosureDepth: 'category',
        notificationPreferences: {
          drawReleased: { inApp: true, email: false, whatsapp: false },
        },
      }),
    ).toEqual({
      defaultRetentionPercentage: 7,
      graceWindowMinutes: 15,
      defaultDisclosureDepth: 'category',
      notificationPreferences: {
        drawReleased: { inApp: true, email: false, whatsapp: false },
      },
    });
  });

  it('rejects empty updates, unknown keys, and enabled WhatsApp', () => {
    expect(() => updateWorkspaceSettingsRequestSchema.parse({})).toThrow();
    expect(() =>
      updateWorkspaceSettingsRequestSchema.parse({ graceWindowMinutes: 10, extra: true }),
    ).toThrow();
    expect(() =>
      updateWorkspaceSettingsRequestSchema.parse({
        notificationPreferences: {
          drawReleased: { inApp: true, email: true, whatsapp: true },
        },
      }),
    ).toThrow();
  });

  it('enforces numeric bounds for workspace defaults', () => {
    expect(() =>
      workspaceSettingsSchema.parse({ ...settingsPayload, defaultRetentionPercentage: 101 }),
    ).toThrow();
    expect(() =>
      workspaceSettingsSchema.parse({ ...settingsPayload, graceWindowMinutes: 0 }),
    ).toThrow();
    expect(() =>
      workspaceSettingsSchema.parse({ ...settingsPayload, suggestionThrottlePerMaterial: -1 }),
    ).toThrow();
  });
});
