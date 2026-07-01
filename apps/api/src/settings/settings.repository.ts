import { Inject, Injectable } from '@nestjs/common';
import type { UpdateWorkspaceSettingsRequest } from '@materiabill/contracts';
import type { DatabaseClient, WorkspaceSettingsRecord } from '@materiabill/db';
import { seedWorkspaceSettingsDefaults, workspaceSettings } from '@materiabill/db';
import { eq, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';

type Db = DatabaseClient['db'];

@Injectable()
export class SettingsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async getOrSeedWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsRecord> {
    await seedWorkspaceSettingsDefaults(this.#db, [workspaceId]);

    return this.findRequiredWorkspaceSettings(workspaceId);
  }

  async updateWorkspaceSettings(
    workspaceId: string,
    patch: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsRecord> {
    await seedWorkspaceSettingsDefaults(this.#db, [workspaceId]);
    const { notificationPreferences, ...scalarPatch } = patch;

    const rows = await this.#db
      .update(workspaceSettings)
      .set({
        ...scalarPatch,
        ...(notificationPreferences !== undefined
          ? {
              notificationPreferences: sql`${workspaceSettings.notificationPreferences} || ${JSON.stringify(notificationPreferences)}::jsonb`,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaceSettings.workspaceId, workspaceId))
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to update workspace settings');
    }

    return row;
  }

  private async findRequiredWorkspaceSettings(
    workspaceId: string,
  ): Promise<WorkspaceSettingsRecord> {
    const rows = await this.#db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspaceId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new Error('Failed to seed workspace settings');
    }

    return row;
  }
}
