import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assertMoneyKindReadable,
  assertReadableAudience,
  audienceScopeSchema,
  canReadAudience,
  canReadMoneyKind,
  filterAudienceItems,
  moneyVisibilityKindSchema,
} from './audience.js';

describe('audience contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts the operational audience scopes in display order', () => {
    expect(audienceScopeSchema.options).toEqual(['org', 'participants', 'client']);
    expect(audienceScopeSchema.parse('org')).toBe('org');
    expect(audienceScopeSchema.parse('participants')).toBe('participants');
    expect(audienceScopeSchema.parse('client')).toBe('client');
  });

  it('rejects unknown audience scopes', () => {
    expect(() => audienceScopeSchema.parse('internal')).toThrow();
  });

  it('allows broader viewers to read narrower record audiences', () => {
    expect(canReadAudience('org', 'org')).toBe(true);
    expect(canReadAudience('participants', 'org')).toBe(true);
    expect(canReadAudience('client', 'org')).toBe(true);
    expect(canReadAudience('participants', 'participants')).toBe(true);
    expect(canReadAudience('client', 'participants')).toBe(true);
    expect(canReadAudience('client', 'client')).toBe(true);
  });

  it('skips schema parsing for valid audience visibility checks', () => {
    const parseAudienceScope = vi.spyOn(audienceScopeSchema, 'parse');

    expect(canReadAudience('client', 'participants')).toBe(true);
    expect(canReadAudience('org', 'client')).toBe(false);

    expect(parseAudienceScope).not.toHaveBeenCalled();
  });

  it('parses audience values inherited from Object.prototype instead of using rank shortcuts', () => {
    Object.defineProperty(Object.prototype, 'public', {
      configurable: true,
      value: 1,
    });

    try {
      expect(() => canReadAudience('public' as never, 'org')).toThrow();
      expect(() => canReadAudience('client', 'public' as never)).toThrow();
    } finally {
      delete (Object.prototype as { public?: number }).public;
    }
  });

  it('denies viewers from reading broader record audiences', () => {
    expect(canReadAudience('org', 'participants')).toBe(false);
    expect(canReadAudience('org', 'client')).toBe(false);
    expect(canReadAudience('participants', 'client')).toBe(false);
    expect(() => {
      assertReadableAudience('org', 'client');
    }).toThrow('Audience scope denied');
  });

  it('filters items to the viewer-readable audience set', () => {
    const rows = [
      { id: 'internal-cost', audience: 'org' as const },
      { id: 'participant-note', audience: 'participants' as const },
      { id: 'client-update', audience: 'client' as const },
    ];

    expect(filterAudienceItems(rows, 'org', (row) => row.audience).map((row) => row.id)).toEqual([
      'internal-cost',
      'participant-note',
      'client-update',
    ]);
    expect(
      filterAudienceItems(rows, 'participants', (row) => row.audience).map((row) => row.id),
    ).toEqual(['participant-note', 'client-update']);
    expect(filterAudienceItems(rows, 'client', (row) => row.audience).map((row) => row.id)).toEqual(
      ['client-update'],
    );
  });

  it('keeps money-out hidden from non-org viewers', () => {
    expect(moneyVisibilityKindSchema.options).toEqual(['money_in', 'money_out']);
    expect(canReadMoneyKind('money_in', 'client')).toBe(true);
    expect(canReadMoneyKind('money_out', 'org')).toBe(true);
    expect(canReadMoneyKind('money_out', 'participants')).toBe(false);
    expect(canReadMoneyKind('money_out', 'client')).toBe(false);
    expect(() => {
      assertMoneyKindReadable('money_out', 'client');
    }).toThrow('Money-out records are not visible to this audience');
  });

  it('skips schema parsing for valid money visibility checks', () => {
    const parseMoneyVisibilityKind = vi.spyOn(moneyVisibilityKindSchema, 'parse');
    const parseAudienceScope = vi.spyOn(audienceScopeSchema, 'parse');

    expect(canReadMoneyKind('money_in', 'client')).toBe(true);
    expect(canReadMoneyKind('money_out', 'participants')).toBe(false);

    expect(parseMoneyVisibilityKind).not.toHaveBeenCalled();
    expect(parseAudienceScope).not.toHaveBeenCalled();
  });

  it('parses money visibility audiences inherited from Object.prototype instead of using rank shortcuts', () => {
    Object.defineProperty(Object.prototype, 'public', {
      configurable: true,
      value: 1,
    });

    try {
      expect(() => canReadMoneyKind('money_in', 'public' as never)).toThrow();
      expect(() => canReadMoneyKind('money_out', 'public' as never)).toThrow();
    } finally {
      delete (Object.prototype as { public?: number }).public;
    }
  });
});
