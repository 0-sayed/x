import { z } from 'zod';

import { currencyCodeSchema } from './money.js';

export const defaultDisclosureDepthSchema = z.enum(['none', 'category', 'line']);
export const defaultLanguageSchema = z.enum(['en', 'ar']);

export const notificationChannelPreferenceSchema = z
  .object({
    inApp: z.boolean(),
    email: z.boolean(),
    whatsapp: z.literal(false),
  })
  .strict();

export const workspaceNotificationPreferencesSchema = z.record(
  z.string().trim().min(1).max(120),
  notificationChannelPreferenceSchema,
);

const baseWorkspaceSettingsSchema = z
  .object({
    currency: currencyCodeSchema,
    timezone: z.string().trim().min(1).max(80),
    defaultLanguage: defaultLanguageSchema,
    defaultRetentionPercentage: z.coerce.number().int().min(0).max(100),
    graceWindowMinutes: z.coerce.number().int().min(1).max(1440),
    defaultDisclosureDepth: defaultDisclosureDepthSchema,
    suggestionThrottlePerMaterial: z.coerce.number().int().min(0).max(100),
    inviteAutoNudgeHours: z.coerce.number().int().min(1).max(720),
    notificationPreferences: workspaceNotificationPreferencesSchema,
  })
  .strict();

export const workspaceSettingsSchema = baseWorkspaceSettingsSchema
  .extend({
    workspaceId: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const updateWorkspaceSettingsRequestSchema = baseWorkspaceSettingsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one workspace setting must be provided.',
  });

export const workspaceSettingsResponseSchema = z
  .object({
    settings: workspaceSettingsSchema,
  })
  .strict();

export type DefaultDisclosureDepth = z.infer<typeof defaultDisclosureDepthSchema>;
export type DefaultLanguage = z.infer<typeof defaultLanguageSchema>;
export type NotificationChannelPreference = z.infer<
  typeof notificationChannelPreferenceSchema
>;
export type WorkspaceNotificationPreferences = z.infer<
  typeof workspaceNotificationPreferencesSchema
>;
export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
export type UpdateWorkspaceSettingsRequest = z.infer<
  typeof updateWorkspaceSettingsRequestSchema
>;
export type WorkspaceSettingsResponse = z.infer<typeof workspaceSettingsResponseSchema>;
