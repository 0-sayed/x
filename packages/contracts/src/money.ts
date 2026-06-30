import { z } from 'zod';

export const supportedCurrencyCodes = ['SAR', 'EGP'] as const;

export const currencyCodeSchema = z.enum(supportedCurrencyCodes);

export const moneyAmountMinorSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger, 'amountMinor must be a safe integer.');

export const moneySchema = z.object({
  amountMinor: moneyAmountMinorSchema,
  currency: currencyCodeSchema,
});

export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type Money = z.infer<typeof moneySchema>;

function assertSafeMinorUnitAmount(amountMinor: number): number {
  return moneyAmountMinorSchema.parse(amountMinor);
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot combine ${left.currency} money with ${right.currency} money.`);
  }
}

export function makeMoney(amountMinor: number, currency: CurrencyCode): Money {
  return moneySchema.parse({
    amountMinor,
    currency,
  });
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);

  return makeMoney(assertSafeMinorUnitAmount(left.amountMinor + right.amountMinor), left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);

  return makeMoney(assertSafeMinorUnitAmount(left.amountMinor - right.amountMinor), left.currency);
}

export function negateMoney(money: Money): Money {
  return makeMoney(assertSafeMinorUnitAmount(-money.amountMinor), money.currency);
}
