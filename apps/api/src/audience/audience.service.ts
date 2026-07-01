import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  assertMoneyKindReadable as assertContractMoneyKindReadable,
  assertReadableAudience,
  filterAudienceItems,
  type AudienceScope,
  type MoneyVisibilityKind,
} from '@materiabill/contracts';

const audienceScopeDeniedMessage = 'Audience scope denied';
const moneyOutDeniedMessage = 'Money-out records are not visible to this audience';

@Injectable()
export class AudienceService {
  assertReadable(recordAudience: AudienceScope, viewerAudience: AudienceScope): void {
    try {
      assertReadableAudience(recordAudience, viewerAudience);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === audienceScopeDeniedMessage) {
        throw new ForbiddenException(audienceScopeDeniedMessage);
      }
      throw error;
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
    try {
      assertContractMoneyKindReadable(kind, viewerAudience);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === moneyOutDeniedMessage) {
        throw new ForbiddenException(moneyOutDeniedMessage);
      }
      throw error;
    }
  }
}
