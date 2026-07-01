import { describe, expect, it } from 'vitest';

import {
  clientIdentityContactSchema,
  clientIdentitySchema,
  createClientIdentityRequestSchema,
} from './client-identities.js';

describe('client identity contracts', () => {
  it('normalizes exact email contacts for lookup', () => {
    expect(clientIdentityContactSchema.parse({ email: ' CLIENT@Example.COM ' })).toEqual({
      email: 'client@example.com',
    });
  });

  it('accepts exact phone contacts for lookup', () => {
    expect(clientIdentityContactSchema.parse({ phoneE164: '+966555123456' })).toEqual({
      phoneE164: '+966555123456',
    });
  });

  it('rejects lookup without a verified contact channel', () => {
    expect(() => clientIdentityContactSchema.parse({})).toThrow();
  });

  it('requires verification timestamps for provided create contacts', () => {
    expect(() =>
      createClientIdentityRequestSchema.parse({
        displayName: 'Client One',
        email: 'client@example.com',
      }),
    ).toThrow();

    expect(
      createClientIdentityRequestSchema.parse({
        displayName: 'Client One',
        email: 'client@example.com',
        verifiedEmailAt: '2026-07-02T00:00:00.000Z',
      }),
    ).toEqual({
      displayName: 'Client One',
      email: 'client@example.com',
      verifiedEmailAt: '2026-07-02T00:00:00.000Z',
    });
  });

  it('serializes identity records with nullable contact fields', () => {
    expect(
      clientIdentitySchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        displayName: 'Client One',
        email: 'client@example.com',
        phoneE164: null,
        verifiedEmailAt: '2026-07-02T00:00:00.000Z',
        verifiedPhoneAt: null,
        inframodernUserId: null,
        createdAt: '2026-07-02T00:00:00.000Z',
        updatedAt: '2026-07-02T00:00:00.000Z',
      }),
    ).toEqual(
      expect.objectContaining({
        displayName: 'Client One',
        email: 'client@example.com',
      }),
    );
  });
});
