import type { NewPendingDecisionRecord } from '@materiabill/db';

export type CreatePendingDecisionRecordInput = NewPendingDecisionRecord;

export type ListActivePendingDecisionsInput = {
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly now: Date;
  readonly limit: number;
};

export type FindPendingDecisionInput = {
  readonly workspaceId: string;
  readonly decisionId: string;
};

export type FindActivePendingDecisionByRecordInput = {
  readonly workspaceId: string;
  readonly decisionType: string;
  readonly recordType: string;
  readonly recordId: string;
  readonly now: Date;
};

export type MutatePendingDecisionInput = {
  readonly workspaceId: string;
  readonly decisionId: string;
  readonly now: Date;
};
