import type {
  CreateScheduleMilestoneRequest,
  CreateSchedulePhaseRequest,
} from '@materiabill/contracts';
import type {
  MilestoneDrawLinkRecord,
  ProjectRecord,
  ScheduleBaselineMilestoneRecord,
  ScheduleBaselineRecord,
  ScheduleForecastMoveRecord,
  ScheduleMilestoneRecord,
  SchedulePhaseRecord,
} from '@materiabill/db';

export type ScheduleIdentityInput = {
  readonly workspaceId: string;
  readonly projectId: string;
};

export type PhaseIdentityInput = ScheduleIdentityInput & {
  readonly phaseId: string;
};

export type MilestoneIdentityInput = ScheduleIdentityInput & {
  readonly milestoneId: string;
};

export type CreateSchedulePhaseInput = ScheduleIdentityInput &
  CreateSchedulePhaseRequest & {
    readonly now: Date;
  };

export type UpdateSchedulePhaseInput = PhaseIdentityInput & {
  readonly name?: string;
  readonly startsOn?: string | null;
  readonly endsOn?: string | null;
  readonly displayOrder?: number;
  readonly now: Date;
};

export type CreateScheduleMilestoneInput = ScheduleIdentityInput &
  CreateScheduleMilestoneRequest & {
    readonly now: Date;
  };

export type UpdateScheduleMilestoneInput = MilestoneIdentityInput & {
  readonly phaseId?: string;
  readonly name?: string;
  readonly description?: string | null;
  readonly displayOrder?: number;
  readonly now: Date;
};

export type MoveForecastDateInput = MilestoneIdentityInput & {
  readonly forecastDate: string;
  readonly reason: string;
  readonly movedByUserId: string;
  readonly now: Date;
};

export type MoveForecastDateResult = {
  readonly milestone: ScheduleMilestoneRecord;
  readonly move: ScheduleForecastMoveRecord;
};

export type CompleteMilestoneInput = MilestoneIdentityInput & {
  readonly completedByUserId: string;
  readonly now: Date;
};

export type ReplaceDrawLinksInput = MilestoneIdentityInput & {
  readonly drawItemIds: readonly string[];
};

export type BaselineSnapshotItemInput = {
  readonly sourceMilestoneId: string;
  readonly phaseName: string;
  readonly milestoneName: string;
  readonly baselineDate: string;
  readonly displayOrder: number;
};

export type ProposeBaselineInput = ScheduleIdentityInput & {
  readonly baselineId: string;
  readonly proposedByUserId: string;
  readonly signOffId: string;
  readonly milestones: readonly BaselineSnapshotItemInput[];
  readonly now: Date;
};

export type SelfCertifyBaselineInput = ScheduleIdentityInput & {
  readonly selfCertifiedByUserId: string;
  readonly reason: string;
  readonly milestones: readonly BaselineSnapshotItemInput[];
  readonly now: Date;
};

export type MarkBaselineAgreedBySignOffInput = {
  readonly workspaceId: string;
  readonly signOffId: string;
  readonly agreedAt: Date;
};

export type ScheduleReadModel = {
  readonly phases: SchedulePhaseRecord[];
  readonly milestones: ScheduleMilestoneRecord[];
  readonly forecastMoves: ScheduleForecastMoveRecord[];
  readonly drawLinks: MilestoneDrawLinkRecord[];
  readonly baseline: ScheduleBaselineRecord | null;
  readonly baselineMilestones: ScheduleBaselineMilestoneRecord[];
};

export type ScheduleProjectRecord = Pick<ProjectRecord, 'id' | 'workspaceId' | 'archivedAt'>;
