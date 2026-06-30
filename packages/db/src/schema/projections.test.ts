import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  brandRefs,
  exchangeRateRefs,
  inframodernUserRefs,
  locationRefs,
  measurementUnitRefs,
  taxRefs,
  workspaceMembershipRefs,
  workspaceRefs,
} from './projections.js';

type ProjectionTable =
  | typeof inframodernUserRefs
  | typeof workspaceRefs
  | typeof workspaceMembershipRefs
  | typeof brandRefs
  | typeof locationRefs
  | typeof exchangeRateRefs
  | typeof measurementUnitRefs
  | typeof taxRefs;

const columnNames = (table: ProjectionTable) => Object.keys(getTableColumns(table));

const indexNames = (table: ProjectionTable) =>
  getTableConfig(table)
    .indexes.map((index) => index.config.name)
    .sort();

describe('projection schema', () => {
  it('uses stable Inframodern projection table names', () => {
    expect(getTableName(inframodernUserRefs)).toBe('inframodern_user_refs');
    expect(getTableName(workspaceRefs)).toBe('workspace_refs');
    expect(getTableName(workspaceMembershipRefs)).toBe('workspace_membership_refs');
    expect(getTableName(brandRefs)).toBe('brand_refs');
    expect(getTableName(locationRefs)).toBe('location_refs');
    expect(getTableName(exchangeRateRefs)).toBe('exchange_rate_refs');
    expect(getTableName(measurementUnitRefs)).toBe('measurement_unit_refs');
    expect(getTableName(taxRefs)).toBe('tax_refs');
  });

  it('keeps user projection columns explicit', () => {
    expect(columnNames(inframodernUserRefs)).toEqual([
      'id',
      'email',
      'displayName',
      'phone',
      'avatarUrl',
      'locale',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps workspace projection columns explicit', () => {
    expect(columnNames(workspaceRefs)).toEqual([
      'id',
      'name',
      'slug',
      'paymentCurrency',
      'isInstalled',
      'subscriptionActive',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps workspace membership projection columns explicit', () => {
    expect(columnNames(workspaceMembershipRefs)).toEqual([
      'workspaceId',
      'userId',
      'roleKey',
      'permissions',
      'isAdmin',
      'isActive',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps brand projection columns explicit', () => {
    expect(columnNames(brandRefs)).toEqual([
      'id',
      'workspaceId',
      'name',
      'accentColor',
      'logoUrl',
      'customDomain',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps location projection columns explicit', () => {
    expect(columnNames(locationRefs)).toEqual([
      'id',
      'workspaceId',
      'name',
      'addressLine1',
      'addressLine2',
      'city',
      'region',
      'countryCode',
      'latitude',
      'longitude',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps exchange rate projection columns explicit', () => {
    expect(columnNames(exchangeRateRefs)).toEqual([
      'id',
      'baseCurrency',
      'quoteCurrency',
      'rate',
      'effectiveAt',
      'source',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('keeps reserved unit and tax projection columns explicit', () => {
    expect(columnNames(measurementUnitRefs)).toEqual([
      'id',
      'code',
      'name',
      'symbol',
      'category',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);

    expect(columnNames(taxRefs)).toEqual([
      'id',
      'code',
      'name',
      'rate',
      'countryCode',
      'rawPayload',
      'syncedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ]);
  });

  it('uses workspace and user as the workspace membership primary key', () => {
    const primaryKeys = getTableConfig(workspaceMembershipRefs).primaryKeys.map((key) =>
      key.getName(),
    );

    expect(primaryKeys).toEqual(['workspace_membership_refs_workspace_id_user_id_pk']);
  });

  it('adds lookup indexes used by upcoming session, workspace, and sync modules', () => {
    expect(indexNames(inframodernUserRefs)).toEqual(['inframodern_user_refs_email_idx']);
    expect(indexNames(workspaceRefs)).toEqual(['workspace_refs_slug_idx']);
    expect(indexNames(workspaceMembershipRefs)).toEqual([
      'workspace_membership_refs_user_id_idx',
      'workspace_membership_refs_workspace_id_idx',
    ]);
    expect(indexNames(brandRefs)).toEqual(['brand_refs_workspace_id_idx']);
    expect(indexNames(locationRefs)).toEqual(['location_refs_workspace_id_idx']);
    expect(indexNames(exchangeRateRefs)).toEqual([
      'exchange_rate_refs_base_quote_effective_at_idx',
    ]);
    expect(indexNames(measurementUnitRefs)).toEqual(['measurement_unit_refs_code_idx']);
    expect(indexNames(taxRefs)).toEqual(['tax_refs_code_idx']);
  });
});
