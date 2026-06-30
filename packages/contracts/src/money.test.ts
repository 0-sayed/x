import { describe, expect, it } from 'vitest';

import {
  addMoney,
  currencyCodeSchema,
  makeMoney,
  moneySchema,
  negateMoney,
  subtractMoney,
  supportedCurrencyCodes,
} from './money.js';

describe('money contracts', () => {
  it('accepts supported v1 currency codes', () => {
    expect(supportedCurrencyCodes).toEqual(['SAR', 'EGP']);
    expect(currencyCodeSchema.parse('SAR')).toBe('SAR');
    expect(currencyCodeSchema.parse('EGP')).toBe('EGP');
  });

  it('rejects unsupported currency codes', () => {
    expect(() => currencyCodeSchema.parse('USD')).toThrow();
  });

  it('parses integer minor-unit money values', () => {
    expect(moneySchema.parse({ amountMinor: 1250, currency: 'SAR' })).toEqual({
      amountMinor: 1250,
      currency: 'SAR',
    });
  });

  it('rejects fractional and unsafe minor-unit values', () => {
    expect(() => moneySchema.parse({ amountMinor: 12.5, currency: 'SAR' })).toThrow();
    expect(() =>
      moneySchema.parse({ amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'SAR' }),
    ).toThrow();
  });

  it('adds and subtracts same-currency money', () => {
    expect(addMoney(makeMoney(500, 'SAR'), makeMoney(250, 'SAR'))).toEqual({
      amountMinor: 750,
      currency: 'SAR',
    });
    expect(subtractMoney(makeMoney(500, 'SAR'), makeMoney(250, 'SAR'))).toEqual({
      amountMinor: 250,
      currency: 'SAR',
    });
  });

  it('negates money without changing currency', () => {
    expect(negateMoney(makeMoney(500, 'EGP'))).toEqual({
      amountMinor: -500,
      currency: 'EGP',
    });
  });

  it('rejects mixed-currency arithmetic', () => {
    expect(() => addMoney(makeMoney(500, 'SAR'), makeMoney(250, 'EGP'))).toThrow(
      'Cannot combine SAR money with EGP money.',
    );
  });
});
