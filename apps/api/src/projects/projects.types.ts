import type {
  CreateProjectRequest,
  ProjectListQuery,
  ProjectParticipantInput,
  UpdateProjectRequest,
} from '@materiabill/contracts';

export type CreateProjectRecordInput = CreateProjectRequest & {
  readonly workspaceId: string;
  readonly createdByUserId: string | null;
};

export type ListProjectsInput = ProjectListQuery & {
  readonly workspaceId: string;
};

export type ProjectIdentityInput = {
  readonly workspaceId: string;
  readonly projectId: string;
};

export type UpdateProjectRecordInput = ProjectIdentityInput & UpdateProjectRequest;

export type ArchiveProjectInput = ProjectIdentityInput & {
  readonly archivedAt: Date;
};

export type ReplaceProjectParticipantsInput = ProjectIdentityInput & {
  readonly participants: readonly ProjectParticipantInput[];
};
