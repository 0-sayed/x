import { z } from 'zod';

export const audienceScopeSchema = z.enum(['org', 'participants', 'client']);
export const moneyVisibilityKindSchema = z.enum(['money_in', 'money_out']);

export type AudienceScope = z.infer<typeof audienceScopeSchema>;
export type MoneyVisibilityKind = z.infer<typeof moneyVisibilityKindSchema>;

const audienceScopeRank: Record<AudienceScope, number> = {
  org: 3,
  participants: 2,
  client: 1,
};

export function canReadAudience(
  recordAudience: AudienceScope,
  viewerAudience: AudienceScope,
): boolean {
  const parsedRecordAudience = audienceScopeSchema.parse(recordAudience);
  const parsedViewerAudience = audienceScopeSchema.parse(viewerAudience);

  return audienceScopeRank[parsedViewerAudience] >= audienceScopeRank[parsedRecordAudience];
}

export function assertReadableAudience(
  recordAudience: AudienceScope,
  viewerAudience: AudienceScope,
): void {
  if (!canReadAudience(recordAudience, viewerAudience)) {
    throw new Error('Audience scope denied');
  }
}

export function filterAudienceItems<T>(
  items: readonly T[],
  viewerAudience: AudienceScope,
  getAudience: (item: T) => AudienceScope,
): T[] {
  return items.filter((item) => canReadAudience(getAudience(item), viewerAudience));
}

export function canReadMoneyKind(kind: MoneyVisibilityKind, viewerAudience: AudienceScope): boolean {
  const parsedKind = moneyVisibilityKindSchema.parse(kind);
  const parsedViewerAudience = audienceScopeSchema.parse(viewerAudience);

  return parsedKind === 'money_in' || parsedViewerAudience === 'org';
}

export function assertMoneyKindReadable(
  kind: MoneyVisibilityKind,
  viewerAudience: AudienceScope,
): void {
  if (!canReadMoneyKind(kind, viewerAudience)) {
    throw new Error('Money-out records are not visible to this audience');
  }
}
