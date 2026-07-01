import { workspaceSettings, type NewWorkspaceSettingsRecord } from './schema/settings.js';

type InsertableDb = {
  insert: (table: typeof workspaceSettings) => {
    values: (rows: NewWorkspaceSettingsRecord[]) => {
      onConflictDoNothing: () => Promise<unknown>;
    };
  };
};

export const defaultNotificationPreferences = {
  default: { inApp: true, email: true, whatsapp: false },
  contractorInviteAutoNudge: { inApp: true, email: true, whatsapp: false },
} as const;

export const defaultWorkspaceSettingsValues = {
  currency: 'SAR',
  timezone: 'Asia/Riyadh',
  defaultLanguage: 'en',
  defaultRetentionPercentage: 5,
  graceWindowMinutes: 10,
  defaultDisclosureDepth: 'none',
  suggestionThrottlePerMaterial: 5,
  inviteAutoNudgeHours: 48,
  notificationPreferences: defaultNotificationPreferences,
} as const;

export function buildWorkspaceSettingsDefaults(workspaceId: string): NewWorkspaceSettingsRecord {
  return {
    workspaceId,
    ...defaultWorkspaceSettingsValues,
  };
}

export async function seedWorkspaceSettingsDefaults(
  db: InsertableDb,
  workspaceIds: readonly string[],
): Promise<void> {
  const uniqueWorkspaceIds = [...new Set(workspaceIds.filter(Boolean))];
  if (uniqueWorkspaceIds.length === 0) {
    return;
  }

  await db
    .insert(workspaceSettings)
    .values(uniqueWorkspaceIds.map((workspaceId) => buildWorkspaceSettingsDefaults(workspaceId)))
    .onConflictDoNothing();
}
