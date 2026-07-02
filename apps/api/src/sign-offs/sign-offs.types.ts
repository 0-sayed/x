import type {
  CreateSignOffInput as ContractCreateSignOffInput,
  SignOffListQuery,
  SignOffResolutionAction,
  SignOffStatus,
} from '@materiabill/contracts';
import type { NewSignOffRecord } from '@materiabill/db';

export type CreateSignOffInput = ContractCreateSignOffInput & {
  readonly now?: Date;
};

export type ListSignOffRowsInput = SignOffListQuery & {
  readonly workspaceId: string;
};

export type FindSignOffInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
};

export type DeletePendingSignOffInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
};

export type ResolveSignOffInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly actorUserId: string;
  readonly action: SignOffResolutionAction;
  readonly reason?: string;
  readonly now?: Date;
};

export type CommitSignOffResolutionInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly decisionId: string;
  readonly actorUserId: string;
  readonly action: SignOffResolutionAction;
  readonly reason?: string;
  readonly now?: Date;
};

export type SendSignOffReminderInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly actorUserId: string;
  readonly now?: Date;
};

export type CreateSignOffRecordInput = NewSignOffRecord;

export type ResolveSignOffRowInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly status: SignOffStatus;
  readonly resolvedByUserId: string;
  readonly resolutionReason: string | null;
  readonly resolutionDecisionId: string;
  readonly now: Date;
};

export type MarkSignOffReminderSentInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly now: Date;
};
