import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { defaultNotificationPreferences } from '../settings-defaults.js';

import { workspaceSettings } from './settings.js';

describe('workspaceSettings schema', () => {
  it('uses one workspace-scoped row for operational defaults', () => {
    expect(workspaceSettings.workspaceId.name).toBe('workspace_id');
    expect(workspaceSettings.currency.name).toBe('currency');
    expect(workspaceSettings.timezone.name).toBe('timezone');
    expect(workspaceSettings.defaultLanguage.name).toBe('default_language');
    expect(workspaceSettings.defaultRetentionPercentage.name).toBe('default_retention_percentage');
    expect(workspaceSettings.graceWindowMinutes.name).toBe('grace_window_minutes');
    expect(workspaceSettings.defaultDisclosureDepth.name).toBe('default_disclosure_depth');
    expect(workspaceSettings.suggestionThrottlePerMaterial.name).toBe(
      'suggestion_throttle_per_material',
    );
    expect(workspaceSettings.inviteAutoNudgeHours.name).toBe('invite_auto_nudge_hours');
    expect(workspaceSettings.notificationPreferences.name).toBe('notification_preferences');
  });

  it('keeps the notification preferences DB default aligned with seeded defaults', () => {
    const dialect = new PgDialect();
    const notificationPreferencesDefault = workspaceSettings.notificationPreferences.default;

    expect(notificationPreferencesDefault).toBeDefined();

    expect(dialect.sqlToQuery(notificationPreferencesDefault as SQL).sql).toBe(
      `'${JSON.stringify(defaultNotificationPreferences)}'::jsonb`,
    );
  });
});
