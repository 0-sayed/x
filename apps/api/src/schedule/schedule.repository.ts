import { Inject, Injectable } from '@nestjs/common';
import {
  milestoneDrawLinks,
  projects,
  scheduleBaselineMilestones,
  scheduleBaselines,
  scheduleForecastMoves,
  scheduleMilestones,
  schedulePhases,
  type DatabaseClient,
  type MilestoneDrawLinkRecord,
  type ProjectRecord,
  type ScheduleBaselineMilestoneRecord,
  type ScheduleBaselineRecord,
  type ScheduleMilestoneRecord,
  type SchedulePhaseRecord,
} from '@materiabill/db';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type {
  CompleteMilestoneInput,
  CreateScheduleMilestoneInput,
  CreateSchedulePhaseInput,
  MarkBaselineAgreedBySignOffInput,
  MoveForecastDateInput,
  MoveForecastDateResult,
  PersistedBaselineSnapshot,
  ProposeBaselineInput,
  ReplaceDrawLinksInput,
  ScheduleIdentityInput,
  ScheduleReadModel,
  SelfCertifyBaselineInput,
  UpdateScheduleMilestoneInput,
  UpdateSchedulePhaseInput,
} from './schedule.types.js';

type Db = DatabaseClient['db'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type QueryDb = Db | Tx;

@Injectable()
export class ScheduleRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async findProject(input: ScheduleIdentityInput): Promise<ProjectRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.id, input.projectId)))
      .limit(1);

    return rows[0];
  }

  async listSchedule(input: ScheduleIdentityInput): Promise<ScheduleReadModel> {
    const phases = await this.#db
      .select()
      .from(schedulePhases)
      .where(
        and(
          eq(schedulePhases.workspaceId, input.workspaceId),
          eq(schedulePhases.projectId, input.projectId),
        ),
      )
      .orderBy(
        asc(schedulePhases.displayOrder),
        asc(schedulePhases.createdAt),
        asc(schedulePhases.id),
      );

    const milestones = await this.#db
      .select()
      .from(scheduleMilestones)
      .where(
        and(
          eq(scheduleMilestones.workspaceId, input.workspaceId),
          eq(scheduleMilestones.projectId, input.projectId),
        ),
      )
      .orderBy(
        asc(scheduleMilestones.displayOrder),
        asc(scheduleMilestones.createdAt),
        asc(scheduleMilestones.id),
      );

    const forecastMoves = await this.#db
      .select()
      .from(scheduleForecastMoves)
      .where(
        and(
          eq(scheduleForecastMoves.workspaceId, input.workspaceId),
          eq(scheduleForecastMoves.projectId, input.projectId),
        ),
      )
      .orderBy(desc(scheduleForecastMoves.movedAt), desc(scheduleForecastMoves.createdAt));

    const drawLinks =
      milestones.length === 0
        ? []
        : await this.#db
            .select()
            .from(milestoneDrawLinks)
            .where(
              and(
                eq(milestoneDrawLinks.workspaceId, input.workspaceId),
                inArray(
                  milestoneDrawLinks.milestoneId,
                  milestones.map((milestone) => milestone.id),
                ),
              ),
            );

    const baselineRows = await this.#db
      .select()
      .from(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.workspaceId, input.workspaceId),
          eq(scheduleBaselines.projectId, input.projectId),
          inArray(scheduleBaselines.status, ['proposed', 'agreed', 'self_certified']),
        ),
      )
      .orderBy(
        sql`case ${scheduleBaselines.status} when 'proposed' then 0 when 'agreed' then 1 else 2 end`,
        desc(scheduleBaselines.updatedAt),
      )
      .limit(1);
    const baseline = baselineRows[0] ?? null;

    const baselineMilestones = baseline
      ? await this.#db
          .select()
          .from(scheduleBaselineMilestones)
          .where(eq(scheduleBaselineMilestones.baselineId, baseline.id))
          .orderBy(asc(scheduleBaselineMilestones.displayOrder), asc(scheduleBaselineMilestones.id))
      : [];

    return { phases, milestones, forecastMoves, drawLinks, baseline, baselineMilestones };
  }

  async createPhase(input: CreateSchedulePhaseInput): Promise<SchedulePhaseRecord | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      if (!project) return undefined;

      const rows = await tx
        .insert(schedulePhases)
        .values({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          name: input.name,
          startsOn: input.startsOn ?? null,
          endsOn: input.endsOn ?? null,
          displayOrder: input.displayOrder,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();

      return rows[0];
    });
  }

  async updatePhase(input: UpdateSchedulePhaseInput): Promise<SchedulePhaseRecord | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      if (!project) return undefined;

      const rows = await tx
        .update(schedulePhases)
        .set({
          ...definedValues({
            name: input.name,
            startsOn: input.startsOn,
            endsOn: input.endsOn,
            displayOrder: input.displayOrder,
          }),
          updatedAt: input.now,
        })
        .where(
          and(
            eq(schedulePhases.workspaceId, input.workspaceId),
            eq(schedulePhases.projectId, input.projectId),
            eq(schedulePhases.id, input.phaseId),
          ),
        )
        .returning();

      return rows[0];
    });
  }

  async createMilestone(
    input: CreateScheduleMilestoneInput,
  ): Promise<ScheduleMilestoneRecord | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      const phase = await this.findPhase(tx, input.workspaceId, input.projectId, input.phaseId);
      if (!project || !phase) return undefined;

      const rows = await tx
        .insert(scheduleMilestones)
        .values({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          phaseId: input.phaseId,
          name: input.name,
          description: input.description ?? null,
          forecastDate: input.forecastDate,
          displayOrder: input.displayOrder,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();

      return rows[0];
    });
  }

  async updateMilestone(
    input: UpdateScheduleMilestoneInput,
  ): Promise<ScheduleMilestoneRecord | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      if (!project) return undefined;

      if (input.phaseId) {
        const phase = await this.findPhase(tx, input.workspaceId, input.projectId, input.phaseId);
        if (!phase) return undefined;
      }

      const rows = await tx
        .update(scheduleMilestones)
        .set({
          ...definedValues({
            phaseId: input.phaseId,
            name: input.name,
            description: input.description,
            displayOrder: input.displayOrder,
          }),
          updatedAt: input.now,
        })
        .where(
          and(
            eq(scheduleMilestones.workspaceId, input.workspaceId),
            eq(scheduleMilestones.projectId, input.projectId),
            eq(scheduleMilestones.id, input.milestoneId),
          ),
        )
        .returning();

      return rows[0];
    });
  }

  async moveForecastDate(
    input: MoveForecastDateInput,
  ): Promise<MoveForecastDateResult | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      const milestone = await this.findMilestone(tx, input);
      if (!project || !milestone) return undefined;

      const milestoneRows = await tx
        .update(scheduleMilestones)
        .set({ forecastDate: input.forecastDate, updatedAt: input.now })
        .where(
          and(
            eq(scheduleMilestones.workspaceId, input.workspaceId),
            eq(scheduleMilestones.projectId, input.projectId),
            eq(scheduleMilestones.id, input.milestoneId),
          ),
        )
        .returning();
      const updated = milestoneRows[0];
      if (!updated) return undefined;

      const moveRows = await tx
        .insert(scheduleForecastMoves)
        .values({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          oldForecastDate: milestone.forecastDate,
          newForecastDate: input.forecastDate,
          reason: input.reason,
          movedByUserId: input.movedByUserId,
          movedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();
      const move = moveRows[0];
      if (!move) throw new Error('Failed to insert schedule forecast move');

      return { milestone: updated, move };
    });
  }

  async completeMilestone(
    input: CompleteMilestoneInput,
  ): Promise<ScheduleMilestoneRecord | undefined> {
    const rows = await this.#db
      .update(scheduleMilestones)
      .set({
        completedAt: input.now,
        completedByUserId: input.completedByUserId,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(scheduleMilestones.workspaceId, input.workspaceId),
          eq(scheduleMilestones.projectId, input.projectId),
          eq(scheduleMilestones.id, input.milestoneId),
          isNull(scheduleMilestones.completedAt),
        ),
      )
      .returning();

    return rows[0];
  }

  async replaceDrawLinks(
    input: ReplaceDrawLinksInput,
  ): Promise<MilestoneDrawLinkRecord[] | undefined> {
    return this.#db.transaction(async (tx) => {
      const milestone = await this.findMilestone(tx, input);
      if (!milestone) return undefined;

      await tx
        .delete(milestoneDrawLinks)
        .where(
          and(
            eq(milestoneDrawLinks.workspaceId, input.workspaceId),
            eq(milestoneDrawLinks.milestoneId, input.milestoneId),
          ),
        );

      if (input.drawItemIds.length === 0) return [];

      return tx
        .insert(milestoneDrawLinks)
        .values(
          input.drawItemIds.map((drawItemId) => ({
            workspaceId: input.workspaceId,
            milestoneId: input.milestoneId,
            drawItemId,
          })),
        )
        .returning();
    });
  }

  async proposeBaseline(
    input: ProposeBaselineInput,
  ): Promise<PersistedBaselineSnapshot | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      if (!project) return undefined;

      const existing = await this.findMutableBaseline(tx, input);
      const rows = existing
        ? await tx
            .update(scheduleBaselines)
            .set({
              status: 'proposed',
              proposedByUserId: input.proposedByUserId,
              signOffId: input.signOffId,
              updatedAt: input.now,
            })
            .where(eq(scheduleBaselines.id, existing.id))
            .returning()
        : await tx
            .insert(scheduleBaselines)
            .values({
              id: input.baselineId,
              workspaceId: input.workspaceId,
              projectId: input.projectId,
              status: 'proposed',
              proposedByUserId: input.proposedByUserId,
              signOffId: input.signOffId,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
      const baseline = rows[0];
      if (!baseline) return undefined;

      const milestones = await this.replaceBaselineMilestones(tx, baseline.id, input.milestones);
      return { baseline, milestones };
    });
  }

  async selfCertifyBaseline(
    input: SelfCertifyBaselineInput,
  ): Promise<PersistedBaselineSnapshot | undefined> {
    return this.#db.transaction(async (tx) => {
      const project = await this.findWritableProject(tx, input);
      if (!project) return undefined;

      const existing = await this.findMutableBaseline(tx, input);
      const rows = existing
        ? await tx
            .update(scheduleBaselines)
            .set({
              status: 'self_certified',
              selfCertifiedByUserId: input.selfCertifiedByUserId,
              selfCertifiedReason: input.reason,
              updatedAt: input.now,
            })
            .where(eq(scheduleBaselines.id, existing.id))
            .returning()
        : await tx
            .insert(scheduleBaselines)
            .values({
              workspaceId: input.workspaceId,
              projectId: input.projectId,
              status: 'self_certified',
              selfCertifiedByUserId: input.selfCertifiedByUserId,
              selfCertifiedReason: input.reason,
              createdAt: input.now,
              updatedAt: input.now,
            })
            .returning();
      const baseline = rows[0];
      if (!baseline) return undefined;

      const milestones = await this.replaceBaselineMilestones(tx, baseline.id, input.milestones);
      return { baseline, milestones };
    });
  }

  async markBaselineAgreedBySignOff(
    input: MarkBaselineAgreedBySignOffInput,
  ): Promise<ScheduleBaselineRecord | undefined> {
    const rows = await this.#db
      .update(scheduleBaselines)
      .set({
        status: 'agreed',
        agreedAt: input.agreedAt,
        updatedAt: input.agreedAt,
      })
      .where(
        and(
          eq(scheduleBaselines.workspaceId, input.workspaceId),
          eq(scheduleBaselines.signOffId, input.signOffId),
          eq(scheduleBaselines.status, 'proposed'),
        ),
      )
      .returning();

    return rows[0];
  }

  private async findWritableProject(
    db: QueryDb,
    input: ScheduleIdentityInput,
  ): Promise<Pick<ProjectRecord, 'id'> | undefined> {
    const rows = await db
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

    return rows[0];
  }

  private async findPhase(
    db: QueryDb,
    workspaceId: string,
    projectId: string,
    phaseId: string,
  ): Promise<Pick<SchedulePhaseRecord, 'id'> | undefined> {
    const rows = await db
      .select({ id: schedulePhases.id })
      .from(schedulePhases)
      .where(
        and(
          eq(schedulePhases.workspaceId, workspaceId),
          eq(schedulePhases.projectId, projectId),
          eq(schedulePhases.id, phaseId),
        ),
      )
      .limit(1);

    return rows[0];
  }

  private async findMilestone(
    db: QueryDb,
    input: {
      readonly workspaceId: string;
      readonly projectId: string;
      readonly milestoneId: string;
    },
  ): Promise<ScheduleMilestoneRecord | undefined> {
    const rows = await db
      .select()
      .from(scheduleMilestones)
      .where(
        and(
          eq(scheduleMilestones.workspaceId, input.workspaceId),
          eq(scheduleMilestones.projectId, input.projectId),
          eq(scheduleMilestones.id, input.milestoneId),
        ),
      )
      .limit(1);

    return rows[0];
  }

  private async findMutableBaseline(
    db: QueryDb,
    input: ScheduleIdentityInput,
  ): Promise<Pick<ScheduleBaselineRecord, 'id'> | undefined> {
    const rows = await db
      .select({ id: scheduleBaselines.id })
      .from(scheduleBaselines)
      .where(
        and(
          eq(scheduleBaselines.workspaceId, input.workspaceId),
          eq(scheduleBaselines.projectId, input.projectId),
          inArray(scheduleBaselines.status, ['draft', 'proposed']),
        ),
      )
      .orderBy(desc(scheduleBaselines.updatedAt))
      .limit(1);

    return rows[0];
  }

  private async replaceBaselineMilestones(
    db: Tx,
    baselineId: string,
    milestones: readonly {
      readonly sourceMilestoneId: string;
      readonly phaseName: string;
      readonly milestoneName: string;
      readonly baselineDate: string;
      readonly displayOrder: number;
    }[],
  ): Promise<ScheduleBaselineMilestoneRecord[]> {
    await db
      .delete(scheduleBaselineMilestones)
      .where(eq(scheduleBaselineMilestones.baselineId, baselineId));

    if (milestones.length === 0) return [];

    return db
      .insert(scheduleBaselineMilestones)
      .values(
        milestones.map((milestone) => ({
          baselineId,
          sourceMilestoneId: milestone.sourceMilestoneId,
          phaseName: milestone.phaseName,
          milestoneName: milestone.milestoneName,
          baselineDate: milestone.baselineDate,
          displayOrder: milestone.displayOrder,
        })),
      )
      .returning();
  }
}

function definedValues<T extends Record<string, unknown>>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, Exclude<unknown, undefined>] => {
      return entry[1] !== undefined;
    }),
  ) as Partial<T>;
}
