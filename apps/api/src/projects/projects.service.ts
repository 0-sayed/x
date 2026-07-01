import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createProjectRequestSchema,
  projectDetailSchema,
  projectListQuerySchema,
  projectListResponseSchema,
  projectParticipantsResponseSchema,
  projectSummarySchema,
  replaceProjectParticipantsRequestSchema,
  updateProjectRequestSchema,
  type ProjectDetail,
  type ProjectListResponse,
  type ProjectParticipantsResponse,
  type ProjectSummary,
  type WorkspaceContext,
} from '@materiabill/contracts';
import type { ProjectParticipantRecord, ProjectRecord } from '@materiabill/db';

import { AuditService } from '../audit/audit.service.js';
import { ProjectsRepository, type ProjectSummaryRow } from './projects.repository.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(ProjectsRepository)
    private readonly projectsRepository: ProjectsRepository,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  async createProject(workspaceContext: WorkspaceContext, body: unknown): Promise<ProjectDetail> {
    const parsed = parseRequest(createProjectRequestSchema, body, 'Invalid project create request');
    const project = await this.projectsRepository.createProject({
      ...parsed,
      now: parsed.now ?? null,
      bottleneck: parsed.bottleneck ?? null,
      pmUserId: parsed.pmUserId ?? null,
      locationId: parsed.locationId ?? null,
      clientOrgId: parsed.clientOrgId ?? null,
      workspaceId: workspaceContext.workspace.id,
      createdByUserId: workspaceContext.membership.userId,
    });

    await this.recordProjectAudit(workspaceContext, project, 'project.created');

    return this.toProjectDetail(project, []);
  }

  async listProjects(
    workspaceContext: WorkspaceContext,
    query: unknown,
  ): Promise<ProjectListResponse> {
    const parsed = parseRequest(projectListQuerySchema, query, 'Invalid project list query');
    const rows = await this.projectsRepository.listProjects({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
    });

    return projectListResponseSchema.parse({
      projects: rows.map((row) => this.toProjectSummary(row)),
      nextCursor: rows.length === parsed.limit ? (rows.at(-1)?.id ?? null) : null,
    });
  }

  async getProject(workspaceContext: WorkspaceContext, projectId: string): Promise<ProjectDetail> {
    const project = await this.requireProject(workspaceContext.workspace.id, projectId);
    const participants = await this.projectsRepository.listParticipants({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });

    return this.toProjectDetail(project, participants);
  }

  async updateProject(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<ProjectDetail> {
    if (body && typeof body === 'object' && 'baselineDeliveryDate' in body) {
      throw new ConflictException('Project baseline delivery date is immutable');
    }

    const parsed = parseRequest(updateProjectRequestSchema, body, 'Invalid project update request');
    const existing = await this.requireProject(workspaceContext.workspace.id, projectId);
    if (existing.archivedAt) {
      throw new ConflictException('Archived projects cannot be edited');
    }

    const updated = await this.projectsRepository.updateProject({
      ...parsed,
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });

    if (!updated) {
      const current = await this.projectsRepository.findProject({
        workspaceId: workspaceContext.workspace.id,
        projectId,
      });
      if (current?.archivedAt) {
        throw new ConflictException('Archived projects cannot be edited');
      }

      throw new NotFoundException('Project not found');
    }

    await this.recordProjectAudit(workspaceContext, updated, 'project.updated');

    const participants = await this.projectsRepository.listParticipants({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    return this.toProjectDetail(updated, participants);
  }

  async archiveProject(
    workspaceContext: WorkspaceContext,
    projectId: string,
  ): Promise<ProjectDetail> {
    await this.requireProject(workspaceContext.workspace.id, projectId);
    const archived = await this.projectsRepository.archiveProject({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      archivedAt: new Date(),
    });

    if (!archived) {
      throw new ConflictException('Project is already archived');
    }

    await this.recordProjectAudit(workspaceContext, archived, 'project.archived');

    const participants = await this.projectsRepository.listParticipants({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });
    return this.toProjectDetail(archived, participants);
  }

  async listParticipants(
    workspaceContext: WorkspaceContext,
    projectId: string,
  ): Promise<ProjectParticipantsResponse> {
    await this.requireProject(workspaceContext.workspace.id, projectId);
    const participants = await this.projectsRepository.listParticipants({
      workspaceId: workspaceContext.workspace.id,
      projectId,
    });

    return projectParticipantsResponseSchema.parse({
      participants: participants.map((participant) => this.toProjectParticipant(participant)),
    });
  }

  async replaceParticipants(
    workspaceContext: WorkspaceContext,
    projectId: string,
    body: unknown,
  ): Promise<ProjectParticipantsResponse> {
    const parsed = parseRequest(
      replaceProjectParticipantsRequestSchema,
      body,
      'Invalid project participants request',
    );
    const project = await this.requireProject(workspaceContext.workspace.id, projectId);
    if (project.archivedAt) {
      throw new ConflictException('Archived project participants cannot be edited');
    }

    const userIds = parsed.participants.map((participant) => participant.userId);
    const activeUserIds = await this.projectsRepository.findActiveMembershipUserIds(
      workspaceContext.workspace.id,
      userIds,
    );
    const missingUserIds = userIds.filter((userId) => !activeUserIds.has(userId));
    if (missingUserIds.length > 0) {
      throw new BadRequestException('Participants must be active workspace members');
    }

    const participants = await this.projectsRepository.replaceParticipants({
      workspaceId: workspaceContext.workspace.id,
      projectId,
      participants: parsed.participants,
    });

    if (!participants) {
      throw new ConflictException('Archived project participants cannot be edited');
    }

    await this.recordProjectAudit(workspaceContext, project, 'project.participants_replaced');

    return projectParticipantsResponseSchema.parse({
      participants: participants.map((participant) => this.toProjectParticipant(participant)),
    });
  }

  private async requireProject(workspaceId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.projectsRepository.findProject({ workspaceId, projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async recordProjectAudit(
    workspaceContext: WorkspaceContext,
    project: ProjectRecord,
    action: string,
  ): Promise<void> {
    await this.auditService.recordEvent({
      workspaceId: workspaceContext.workspace.id,
      actorUserId: workspaceContext.membership.userId,
      audience: 'internal',
      action,
      resourceType: 'project',
      resourceId: project.id,
      metadata: { projectName: project.name },
    });
  }

  private toProjectSummary(row: ProjectSummaryRow): ProjectSummary {
    return projectSummarySchema.parse({
      ...this.projectBase(row),
      participantCount: row.participantCount,
    });
  }

  private toProjectDetail(
    project: ProjectRecord,
    participants: readonly ProjectParticipantRecord[],
  ): ProjectDetail {
    return projectDetailSchema.parse({
      ...this.projectBase(project),
      participantCount: participants.length,
      participants: participants.map((participant) => this.toProjectParticipant(participant)),
    });
  }

  private projectBase(project: ProjectRecord) {
    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      city: project.city,
      currency: project.currency,
      status: project.status,
      now: project.now,
      bottleneck: project.bottleneck,
      baselineDeliveryDate: project.baselineDeliveryDate,
      pmUserId: project.pmUserId,
      locationId: project.locationId,
      clientOrgId: project.clientOrgId,
      archivedAt: project.archivedAt?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private toProjectParticipant(participant: ProjectParticipantRecord) {
    return {
      projectId: participant.projectId,
      workspaceId: participant.workspaceId,
      userId: participant.userId,
      roleLabel: participant.roleLabel,
      createdAt: participant.createdAt.toISOString(),
      updatedAt: participant.updatedAt.toISOString(),
    };
  }
}

type RequestSchema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
};

function parseRequest<T>(schema: RequestSchema<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(message);
  }
  return parsed.data;
}
