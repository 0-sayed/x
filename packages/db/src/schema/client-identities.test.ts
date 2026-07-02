import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { clientIdentities } from './client-identities.js';

describe('client identities schema', () => {
  it('uses native cross-workspace identity columns', () => {
    const columns = getTableColumns(clientIdentities);

    expect(getTableName(clientIdentities)).toBe('client_identities');
    expect(columns.id.name).toBe('id');
    expect(columns.displayName.name).toBe('display_name');
    expect(columns.email.name).toBe('email');
    expect(columns.phoneE164.name).toBe('phone_e164');
    expect(columns.verifiedEmailAt.name).toBe('verified_email_at');
    expect(columns.verifiedPhoneAt.name).toBe('verified_phone_at');
    expect(columns.inframodernUserId.name).toBe('inframodern_user_id');
    expect(columns.createdAt.name).toBe('created_at');
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.updatedAt.name).toBe('updated_at');
    expect(columns.updatedAt.notNull).toBe(true);
    expect('workspaceId' in columns).toBe(false);
  });

  it('declares contact uniqueness indexes and verification checks', () => {
    const config = getTableConfig(clientIdentities);

    expect(config.indexes.map((index) => index.config.name).sort()).toEqual(
      expect.arrayContaining([
        'client_identities_email_unique',
        'client_identities_phone_e164_unique',
        'client_identities_inframodern_user_idx',
      ]),
    );
    expect(config.checks.map((check) => check.name).sort()).toEqual(
      expect.arrayContaining([
        'client_identities_contact_check',
        'client_identities_email_verified_check',
        'client_identities_phone_verified_check',
      ]),
    );
  });
});
