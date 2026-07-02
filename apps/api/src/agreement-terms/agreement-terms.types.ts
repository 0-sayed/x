import type { ConfigureAgreementTermsRequest } from '@materiabill/contracts';

export type ProjectIdentityInput = {
  readonly workspaceId: string;
  readonly projectId: string;
};

export type ProjectTermsEligibility = {
  readonly id: string;
  readonly workspaceId: string;
  readonly archivedAt: Date | null;
};

export type UpsertAgreementTermsInput = ProjectIdentityInput &
  ConfigureAgreementTermsRequest & {
    readonly contractSnapshotMarkdown: string;
    readonly contractSnapshotGeneratedAt: Date;
    readonly configuredByUserId: string;
  };

export type LockAgreementTermsInput = ProjectIdentityInput & {
  readonly drawItemId: string;
  readonly lockedByUserId: string | null;
  readonly lockedAt: Date;
};
