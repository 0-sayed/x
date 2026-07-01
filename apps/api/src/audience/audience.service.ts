import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  canReadAudience,
  canReadMoneyKind,
  filterAudienceItems,
  type AudienceScope,
  type MoneyVisibilityKind,
} from '@materiabill/contracts';

const audienceScopeDeniedMessage = 'Audience scope denied';
const moneyOutDeniedMessage = 'Money-out records are not visible to this audience';

@Injectable()
export class AudienceService {
  assertReadable(recordAudience: AudienceScope, viewerAudience: AudienceScope): void {
    if (!canReadAudience(recordAudience, viewerAudience)) {
      throw new ForbiddenException(audienceScopeDeniedMessage);
    }
  }

  filterReadable<T>(
    items: readonly T[],
    viewerAudience: AudienceScope,
    getAudience: (item: T) => AudienceScope,
  ): T[] {
    return filterAudienceItems(items, viewerAudience, getAudience);
  }

  assertMoneyKindReadable(kind: MoneyVisibilityKind, viewerAudience: AudienceScope): void {
    if (!canReadMoneyKind(kind, viewerAudience)) {
      throw new ForbiddenException(moneyOutDeniedMessage);
    }
  }
}
