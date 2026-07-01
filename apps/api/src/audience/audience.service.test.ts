import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudienceService } from './audience.service.js';

describe('AudienceService', () => {
  afterEach(() => {
    vi.doUnmock('@materiabill/contracts');
    vi.resetModules();
  });

  it('allows readable audience combinations', () => {
    const service = new AudienceService();

    expect(() => {
      service.assertReadable('org', 'org');
    }).not.toThrow();
    expect(() => {
      service.assertReadable('participants', 'org');
    }).not.toThrow();
    expect(() => {
      service.assertReadable('client', 'participants');
    }).not.toThrow();
    expect(() => {
      service.assertReadable('client', 'client');
    }).not.toThrow();
  });

  it('throws ForbiddenException for denied audience combinations', () => {
    const service = new AudienceService();

    expect(() => {
      service.assertReadable('org', 'client');
    }).toThrow(ForbiddenException);
    expect(() => {
      service.assertReadable('participants', 'client');
    }).toThrow('Audience scope denied');
  });

  it('translates denied access through contract boolean helpers', async () => {
    vi.resetModules();
    vi.doMock('@materiabill/contracts', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@materiabill/contracts')>();

      return {
        ...actual,
        assertMoneyKindReadable: vi.fn(() => {
          throw new Error('renamed money denial');
        }),
        assertReadableAudience: vi.fn(() => {
          throw new Error('renamed audience denial');
        }),
        canReadAudience: vi.fn(() => false),
        canReadMoneyKind: vi.fn(() => false),
      };
    });

    const { AudienceService: MockedAudienceService } = await import('./audience.service.js');
    const service = new MockedAudienceService();

    expect(() => {
      service.assertReadable('org', 'client');
    }).toThrow(ForbiddenException);
    expect(() => {
      service.assertMoneyKindReadable('money_out', 'client');
    }).toThrow(ForbiddenException);
  });

  it('propagates invalid contract errors instead of masking them as ForbiddenException', () => {
    const service = new AudienceService();
    let audienceError: unknown;
    let moneyKindError: unknown;

    try {
      Reflect.apply(service.assertReadable.bind(service), undefined, ['invalid-audience', 'org']);
    } catch (error) {
      audienceError = error;
    }

    try {
      Reflect.apply(service.assertMoneyKindReadable.bind(service), undefined, [
        'invalid-money-kind',
        'org',
      ]);
    } catch (error) {
      moneyKindError = error;
    }

    expect(audienceError).toBeDefined();
    expect(audienceError).not.toBeInstanceOf(ForbiddenException);
    expect(moneyKindError).toBeDefined();
    expect(moneyKindError).not.toBeInstanceOf(ForbiddenException);
  });

  it('filters rows to the readable audience set', () => {
    const service = new AudienceService();
    const rows = [
      { id: 'payable', audience: 'org' as const },
      { id: 'participant-note', audience: 'participants' as const },
      { id: 'client-summary', audience: 'client' as const },
    ];

    expect(service.filterReadable(rows, 'participants', (row) => row.audience)).toEqual([
      { id: 'participant-note', audience: 'participants' },
      { id: 'client-summary', audience: 'client' },
    ]);
  });

  it('keeps money-out hidden outside org audience', () => {
    const service = new AudienceService();

    expect(() => {
      service.assertMoneyKindReadable('money_in', 'client');
    }).not.toThrow();
    expect(() => {
      service.assertMoneyKindReadable('money_out', 'org');
    }).not.toThrow();
    expect(() => {
      service.assertMoneyKindReadable('money_out', 'participants');
    }).toThrow(ForbiddenException);
    expect(() => {
      service.assertMoneyKindReadable('money_out', 'client');
    }).toThrow('Money-out records are not visible to this audience');
  });
});
