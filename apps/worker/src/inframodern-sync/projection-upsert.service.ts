import { Inject, Injectable } from '@nestjs/common';
import {
  brandRefs,
  exchangeRateRefs,
  inframodernUserRefs,
  locationRefs,
  seedWorkspaceSettingsDefaults,
  workspaceMembershipRefs,
  workspaceRefs,
  type MateriabillDatabase,
  type NewWorkspaceMembershipRef,
} from '@materiabill/db';
import type { SyncResource } from '@materiabill/contracts';
import { sql } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

import { mapProjectionBatch } from './projection-mappers.js';

export const MATERIABILL_DB = Symbol('MATERIABILL_DB');

@Injectable()
export class ProjectionUpsertService {
  constructor(@Inject(MATERIABILL_DB) private readonly db: MateriabillDatabase) {}

  async upsert(resource: SyncResource, items: readonly Record<string, unknown>[]): Promise<number> {
    const batch = mapProjectionBatch(resource, items);

    await this.upsertById(inframodernUserRefs, batch.users, {
      email: sql.raw('excluded.email'),
      displayName: sql.raw('excluded.display_name'),
      phone: sql.raw('excluded.phone'),
      avatarUrl: sql.raw('excluded.avatar_url'),
      locale: sql.raw('excluded.locale'),
      rawPayload: sql.raw('excluded.raw_payload'),
      syncedAt: sql.raw('excluded.synced_at'),
      updatedAt: sql.raw('excluded.updated_at'),
      deletedAt: sql.raw('excluded.deleted_at'),
    });
    await this.upsertById(workspaceRefs, batch.workspaces, {
      name: sql.raw('excluded.name'),
      slug: sql.raw('excluded.slug'),
      paymentCurrency: sql.raw('excluded.payment_currency'),
      rawPayload: sql.raw('excluded.raw_payload'),
      syncedAt: sql.raw('excluded.synced_at'),
      updatedAt: sql.raw('excluded.updated_at'),
      deletedAt: sql.raw('excluded.deleted_at'),
    });
    await seedWorkspaceSettingsDefaults(
      this.db,
      batch.workspaces.map((workspace) => workspace.id),
    );
    await this.upsertMemberships(batch.memberships);
    await this.upsertById(brandRefs, batch.brands, {
      workspaceId: sql.raw('excluded.workspace_id'),
      name: sql.raw('excluded.name'),
      accentColor: sql.raw('excluded.accent_color'),
      logoUrl: sql.raw('excluded.logo_url'),
      customDomain: sql.raw('excluded.custom_domain'),
      rawPayload: sql.raw('excluded.raw_payload'),
      syncedAt: sql.raw('excluded.synced_at'),
      updatedAt: sql.raw('excluded.updated_at'),
      deletedAt: sql.raw('excluded.deleted_at'),
    });
    await this.upsertById(locationRefs, batch.locations, {
      workspaceId: sql.raw('excluded.workspace_id'),
      name: sql.raw('excluded.name'),
      addressLine1: sql.raw('excluded.address_line_1'),
      addressLine2: sql.raw('excluded.address_line_2'),
      city: sql.raw('excluded.city'),
      region: sql.raw('excluded.region'),
      countryCode: sql.raw('excluded.country_code'),
      latitude: sql.raw('excluded.latitude'),
      longitude: sql.raw('excluded.longitude'),
      rawPayload: sql.raw('excluded.raw_payload'),
      syncedAt: sql.raw('excluded.synced_at'),
      updatedAt: sql.raw('excluded.updated_at'),
      deletedAt: sql.raw('excluded.deleted_at'),
    });
    await this.upsertById(exchangeRateRefs, batch.exchangeRates, {
      baseCurrency: sql.raw('excluded.base_currency'),
      quoteCurrency: sql.raw('excluded.quote_currency'),
      rate: sql.raw('excluded.rate'),
      effectiveAt: sql.raw('excluded.effective_at'),
      source: sql.raw('excluded.source'),
      rawPayload: sql.raw('excluded.raw_payload'),
      syncedAt: sql.raw('excluded.synced_at'),
      updatedAt: sql.raw('excluded.updated_at'),
      deletedAt: sql.raw('excluded.deleted_at'),
    });

    return items.length;
  }

  private async upsertById(
    table: AnyPgTable & { id: AnyPgTable['_']['columns'][string] },
    rows: readonly Record<string, unknown>[],
    set: Record<string, unknown>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db
      .insert(table)
      .values([...rows])
      .onConflictDoUpdate({ target: table.id, set });
  }

  private async upsertMemberships(rows: readonly NewWorkspaceMembershipRef[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await this.db
      .insert(workspaceMembershipRefs)
      .values([...rows])
      .onConflictDoUpdate({
        target: [workspaceMembershipRefs.workspaceId, workspaceMembershipRefs.userId],
        set: {
          roleKey: sql.raw('excluded.role_key'),
          permissions: sql.raw('excluded.permissions'),
          isAdmin: sql.raw('excluded.is_admin'),
          isActive: sql.raw('excluded.is_active'),
          rawPayload: sql.raw('excluded.raw_payload'),
          syncedAt: sql.raw('excluded.synced_at'),
          updatedAt: sql.raw('excluded.updated_at'),
          deletedAt: sql.raw('excluded.deleted_at'),
        },
      });
  }
}
