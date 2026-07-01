import { BadRequestException, Injectable } from '@nestjs/common';
import {
  updateWorkspaceSettingsRequestSchema,
  workspaceSettingsResponseSchema,
  type UpdateWorkspaceSettingsRequest,
  type WorkspaceSettingsResponse,
} from '@materiabill/contracts';
import type { WorkspaceSettingsRecord } from '@materiabill/db';

import { SettingsRepository } from './settings.repository.js';

@Injectable()
export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsResponse> {
    return toResponse(await this.settingsRepository.getOrSeedWorkspaceSettings(workspaceId));
  }

  async updateWorkspaceSettings(
    workspaceId: string,
    body: unknown,
  ): Promise<WorkspaceSettingsResponse> {
    const patch = parseUpdateRequest(body);

    return toResponse(await this.settingsRepository.updateWorkspaceSettings(workspaceId, patch));
  }

  async getGraceWindowMinutes(workspaceId: string): Promise<number> {
    const settings = await this.settingsRepository.getOrSeedWorkspaceSettings(workspaceId);

    return settings.graceWindowMinutes;
  }
}

function parseUpdateRequest(body: unknown): UpdateWorkspaceSettingsRequest {
  const parsed = updateWorkspaceSettingsRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException('Invalid workspace settings request');
  }

  return parsed.data;
}

function toResponse(row: WorkspaceSettingsRecord): WorkspaceSettingsResponse {
  return workspaceSettingsResponseSchema.parse({
    settings: {
      workspaceId: row.workspaceId,
      currency: row.currency,
      timezone: row.timezone,
      defaultLanguage: row.defaultLanguage,
      defaultRetentionPercentage: row.defaultRetentionPercentage,
      graceWindowMinutes: row.graceWindowMinutes,
      defaultDisclosureDepth: row.defaultDisclosureDepth,
      suggestionThrottlePerMaterial: row.suggestionThrottlePerMaterial,
      inviteAutoNudgeHours: row.inviteAutoNudgeHours,
      notificationPreferences: row.notificationPreferences,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  });
}
