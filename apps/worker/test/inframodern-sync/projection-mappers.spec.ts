import { describe, expect, it } from 'vitest';

import { mapProjectionBatch } from '../../src/inframodern-sync/projection-mappers.js';

describe('projection mappers', () => {
  it('maps users and derives workspace memberships', () => {
    const batch = mapProjectionBatch('users', [
      {
        id: '018f3f91-1b79-71ec-9d83-000000000001',
        email: 'owner@example.com',
        name: 'Owner User',
        workspaces: [
          {
            id: '018f3f91-1b79-71ec-9d83-000000000101',
            name: 'Build Co',
            slug: 'build-co',
            paymentCurrency: 'SAR',
            role: 'owner',
            permissions: ['projects:read'],
          },
        ],
        adminWorkspaces: [
          {
            id: '018f3f91-1b79-71ec-9d83-000000000102',
            name: 'Ops Co',
            slug: 'ops-co',
            paymentCurrency: 'AED',
            roleKey: 'admin',
            permissions: ['billing:write'],
          },
        ],
      },
    ]);

    expect(batch.users).toHaveLength(1);
    expect(batch.workspaces).toHaveLength(2);
    expect(batch.memberships).toEqual([
      expect.objectContaining({
        workspaceId: '018f3f91-1b79-71ec-9d83-000000000101',
        userId: '018f3f91-1b79-71ec-9d83-000000000001',
        roleKey: 'owner',
        permissions: ['projects:read'],
        isAdmin: false,
      }),
      expect.objectContaining({
        workspaceId: '018f3f91-1b79-71ec-9d83-000000000102',
        userId: '018f3f91-1b79-71ec-9d83-000000000001',
        roleKey: 'admin',
        permissions: ['billing:write'],
        isAdmin: true,
      }),
    ]);
  });

  it('maps soft deletes from deletedAt', () => {
    const batch = mapProjectionBatch('brands', [
      {
        id: '018f3f91-1b79-71ec-9d83-000000000201',
        workspaceId: '018f3f91-1b79-71ec-9d83-000000000101',
        name: 'Brand One',
        deletedAt: '2026-06-30T10:00:00.000Z',
      },
    ]);

    expect(batch.brands[0]).toMatchObject({
      id: '018f3f91-1b79-71ec-9d83-000000000201',
      deletedAt: new Date('2026-06-30T10:00:00.000Z'),
    });
  });

  it('accepts snake_case rows from pull-source SQL queries', () => {
    const batch = mapProjectionBatch('exchange-rates', [
      {
        id: '018f3f91-1b79-71ec-9d83-000000000401',
        base_currency: 'USD',
        quote_currency: 'SAR',
        rate: 3.75,
        effective_at: '2026-06-30T10:00:00.000Z',
        deleted_at: '2026-06-30T11:00:00.000Z',
      },
    ]);

    expect(batch.exchangeRates).toEqual([
      expect.objectContaining({
        id: '018f3f91-1b79-71ec-9d83-000000000401',
        baseCurrency: 'USD',
        quoteCurrency: 'SAR',
        rate: '3.75',
        effectiveAt: new Date('2026-06-30T10:00:00.000Z'),
        deletedAt: new Date('2026-06-30T11:00:00.000Z'),
      }),
    ]);
  });

  it('ignores malformed optional date values', () => {
    const batch = mapProjectionBatch('brands', [
      {
        id: '018f3f91-1b79-71ec-9d83-000000000202',
        workspaceId: '018f3f91-1b79-71ec-9d83-000000000101',
        name: 'Brand With Bad Date',
        deletedAt: 'not-a-date',
      },
    ]);

    expect(batch.brands[0]?.deletedAt).toBeNull();
  });

  it('rejects rows without Inframodern ids', () => {
    expect(() => mapProjectionBatch('locations', [{ name: 'No Id' }])).toThrow(
      'locations item is missing id',
    );
  });

  it('deduplicates direct resource rows with last occurrence wins', () => {
    const duplicateId = '018f3f91-1b79-71ec-9d83-000000000301';
    const effectiveAt = '2026-06-30T10:00:00.000Z';

    expect(
      mapProjectionBatch('users', [
        { id: duplicateId, email: 'first@example.com' },
        { id: duplicateId, email: 'last@example.com' },
      ]).users,
    ).toEqual([expect.objectContaining({ id: duplicateId, email: 'last@example.com' })]);
    expect(
      mapProjectionBatch('brands', [
        { id: duplicateId, name: 'First Brand' },
        { id: duplicateId, name: 'Last Brand' },
      ]).brands,
    ).toEqual([expect.objectContaining({ id: duplicateId, name: 'Last Brand' })]);
    expect(
      mapProjectionBatch('locations', [
        { id: duplicateId, name: 'First Location' },
        { id: duplicateId, name: 'Last Location' },
      ]).locations,
    ).toEqual([expect.objectContaining({ id: duplicateId, name: 'Last Location' })]);
    expect(
      mapProjectionBatch('exchange-rates', [
        {
          id: duplicateId,
          baseCurrency: 'USD',
          quoteCurrency: 'SAR',
          rate: '3.75',
          effectiveAt,
          source: 'first',
        },
        {
          id: duplicateId,
          baseCurrency: 'USD',
          quoteCurrency: 'AED',
          rate: '3.67',
          effectiveAt,
          source: 'last',
        },
      ]).exchangeRates,
    ).toEqual([expect.objectContaining({ id: duplicateId, quoteCurrency: 'AED', source: 'last' })]);
  });

  it('deduplicates shared workspaces and duplicate memberships with last occurrence wins', () => {
    const workspaceId = '018f3f91-1b79-71ec-9d83-000000000101';
    const userId = '018f3f91-1b79-71ec-9d83-000000000001';
    const duplicateMembershipPayload = {
      id: workspaceId,
      name: 'Build Co Final',
      slug: 'build-co-final',
      paymentCurrency: 'AED',
      role: 'admin',
      permissions: ['billing:write'],
      source: 'last-membership',
    };

    const batch = mapProjectionBatch('users', [
      {
        id: userId,
        email: 'owner@example.com',
        name: 'Owner User',
        workspaces: [
          {
            id: workspaceId,
            name: 'Build Co',
            slug: 'build-co',
            paymentCurrency: 'SAR',
            role: 'owner',
            permissions: ['projects:read'],
            source: 'first-membership',
          },
          duplicateMembershipPayload,
        ],
        adminWorkspaces: [],
      },
      {
        id: '018f3f91-1b79-71ec-9d83-000000000002',
        email: 'member@example.com',
        name: 'Member User',
        workspaces: [
          {
            id: workspaceId,
            name: 'Build Co Shared',
            slug: 'build-co-shared',
            paymentCurrency: 'USD',
            role: 'member',
            permissions: ['projects:comment'],
            source: 'shared-workspace',
          },
        ],
        adminWorkspaces: [],
      },
    ]);

    expect(batch.workspaces).toEqual([
      expect.objectContaining({
        id: workspaceId,
        name: 'Build Co Shared',
        slug: 'build-co-shared',
        paymentCurrency: 'USD',
        rawPayload: expect.objectContaining({
          source: 'shared-workspace',
        }),
      }),
    ]);
    expect(batch.memberships).toEqual([
      expect.objectContaining({
        workspaceId,
        userId,
        roleKey: 'admin',
        permissions: ['billing:write'],
        rawPayload: duplicateMembershipPayload,
      }),
      expect.objectContaining({
        workspaceId,
        userId: '018f3f91-1b79-71ec-9d83-000000000002',
        roleKey: 'member',
        permissions: ['projects:comment'],
      }),
    ]);
  });
});
