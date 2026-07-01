import { Inject, Injectable } from '@nestjs/common';
import {
  projectParticipants,
  projects,
  workspaceMembershipRefs,
  type DatabaseClient,
  type ProjectParticipantRecord,
  type ProjectRecord,
} from '@materiabill/db';
import { and, count, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  ArchiveProjectInput,
  CreateProjectRecordInput,
  ListProjectsInput,
  ProjectIdentityInput,
  ReplaceProjectParticipantsInput,
  UpdateProjectRecordInput,
} from './projects.types.js';

type Db = DatabaseClient['db'];

export type ProjectSummaryRow = ProjectRecord & { participantCount: number };
export type ProjectDetailRow = ProjectSummaryRow & {
  participants: ProjectParticipantRecord[];
};

@Injectable()
export class ProjectsRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async createProject(input: CreateProjectRecordInput): Promise<ProjectRecord> {
    const rows = await this.#db.insert(projects).values(input).returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert project');
    }

    return row;
  }

  async listProjects(input: ListProjectsInput): Promise<ProjectSummaryRow[]> {
    const filters = [
      eq(projects.workspaceId, input.workspaceId),
      input.includeArchived ? undefined : isNull(projects.archivedAt),
      input.city ? eq(projects.city, input.city) : undefined,
      input.pmUserId ? eq(projects.pmUserId, input.pmUserId) : undefined,
      input.status ? eq(projects.status, input.status) : undefined,
      input.role === 'main_contractor' ? isNull(projects.clientOrgId) : undefined,
      input.role === 'as_subcontract' ? isNotNull(projects.clientOrgId) : undefined,
      input.cursor ? lt(projects.id, input.cursor) : undefined,
    ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

    const rows = await this.#db
      .select({
        project: projects,
        participantCount: count(projectParticipants.userId),
      })
      .from(projects)
      .leftJoin(projectParticipants, eq(projects.id, projectParticipants.projectId))
      .where(and(...filters))
      .groupBy(projects.id)
      .orderBy(desc(projects.id))
      .limit(input.limit);

    return rows.map((row) => ({
      ...row.project,
      participantCount: normalizeParticipantCount(row.participantCount),
    }));
  }

  async findProjectDetail(input: ProjectIdentityInput): Promise<ProjectDetailRow | undefined> {
    const rows = await this.#db
      .select({
        project: projects,
        participantCount: count(projectParticipants.userId),
      })
      .from(projects)
      .leftJoin(projectParticipants, eq(projects.id, projectParticipants.projectId))
      .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
      .groupBy(projects.id)
      .orderBy(desc(projects.id))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return undefined;
    }

    const participants = await this.listParticipants(input);

    return {
      ...row.project,
      participantCount: normalizeParticipantCount(row.participantCount),
      participants,
    };
  }

  async findProject(input: ProjectIdentityInput): Promise<ProjectRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
      .limit(1);

    return rows[0];
  }

  async updateProject(input: UpdateProjectRecordInput): Promise<ProjectRecord | undefined> {
    const { workspaceId, projectId, ...changes } = input;
    const rows = await this.#db
      .update(projects)
      .set(changes)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          eq(projects.id, projectId),
          isNull(projects.archivedAt),
        ),
      )
      .returning();

    return rows[0];
  }

  async archiveProject(input: ArchiveProjectInput): Promise<ProjectRecord | undefined> {
    const rows = await this.#db
      .update(projects)
      .set({
        archivedAt: input.archivedAt,
        updatedAt: input.archivedAt,
      })
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          eq(projects.id, input.projectId),
          isNull(projects.archivedAt),
        ),
      )
      .returning();

    return rows[0];
  }

  async listParticipants(input: ProjectIdentityInput): Promise<ProjectParticipantRecord[]> {
    return this.#db
      .select()
      .from(projectParticipants)
      .where(
        and(
          eq(projectParticipants.workspaceId, input.workspaceId),
          eq(projectParticipants.projectId, input.projectId),
        ),
      );
  }

  async replaceParticipants(
    input: ReplaceProjectParticipantsInput,
  ): Promise<ProjectParticipantRecord[] | undefined> {
    return this.#db.transaction(async (tx) => {
      const projectRows = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, input.workspaceId),
            eq(projects.id, input.projectId),
            isNull(projects.archivedAt),
          ),
        )
        .limit(1);

      if (!projectRows[0]) {
        return undefined;
      }

      await tx
        .delete(projectParticipants)
        .where(
          and(
            eq(projectParticipants.workspaceId, input.workspaceId),
            eq(projectParticipants.projectId, input.projectId),
          ),
        );

      if (input.participants.length === 0) {
        return [];
      }

      const rows = await tx
        .insert(projectParticipants)
        .values(
          input.participants.map((participant) => ({
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            userId: participant.userId,
            roleLabel: participant.roleLabel,
          })),
        )
        .returning();

      return rows;
    });
  }

  async findActiveMembershipUserIds(
    workspaceId: string,
    userIds: readonly string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const rows = await this.#db
      .select({ userId: workspaceMembershipRefs.userId })
      .from(workspaceMembershipRefs)
      .where(
        and(
          eq(workspaceMembershipRefs.workspaceId, workspaceId),
          eq(workspaceMembershipRefs.isActive, true),
          isNull(workspaceMembershipRefs.deletedAt),
          inArray(workspaceMembershipRefs.userId, userIds),
        ),
      );

    return new Set(rows.map((row) => row.userId));
  }
}

function normalizeParticipantCount(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}
