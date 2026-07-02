import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  milestoneDrawLinks,
  scheduleBaselineMilestones,
  scheduleBaselines,
  scheduleForecastMoves,
  scheduleMilestones,
  schedulePhases,
} from './schedule.js';

const scheduleMigrationSql = () =>
  readFileSync(new URL('../../drizzle/0014_schedule.sql', import.meta.url), 'utf8');

const foreignKeyNames = (
  table:
    | typeof scheduleBaselines
    | typeof scheduleForecastMoves
    | typeof scheduleMilestones
    | typeof schedulePhases,
) =>
  getTableConfig(table)
    .foreignKeys.map((foreignKey) => foreignKey.getName())
    .sort();

const uniqueConstraintNames = (table: typeof scheduleMilestones | typeof schedulePhases) =>
  getTableConfig(table)
    .uniqueConstraints.map((constraint) => constraint.getName())
    .sort();

const checkNames = (table: typeof scheduleBaselineMilestones) =>
  getTableConfig(table)
    .checks.map((check) => check.name)
    .sort();

describe('schedule schema', () => {
  it('exports schedule tables with stable table names', () => {
    expect(getTableName(schedulePhases)).toBe('schedule_phases');
    expect(getTableName(scheduleMilestones)).toBe('schedule_milestones');
    expect(getTableName(scheduleForecastMoves)).toBe('schedule_forecast_moves');
    expect(getTableName(scheduleBaselines)).toBe('schedule_baselines');
    expect(getTableName(scheduleBaselineMilestones)).toBe('schedule_baseline_milestones');
    expect(getTableName(milestoneDrawLinks)).toBe('milestone_draw_links');
  });

  it('enforces project-scoped schedule relationships', () => {
    expect(uniqueConstraintNames(schedulePhases)).toContain(
      'schedule_phases_workspace_id_project_id_id_unique',
    );
    expect(uniqueConstraintNames(scheduleMilestones)).toContain(
      'schedule_milestones_workspace_id_project_id_id_unique',
    );
    expect(foreignKeyNames(scheduleMilestones)).toContain(
      'schedule_milestones_workspace_id_project_id_phase_id_schedule_phases_workspace_id_project_id_id_fk',
    );
    expect(foreignKeyNames(scheduleForecastMoves)).toContain(
      'schedule_forecast_moves_workspace_id_project_id_milestone_id_milestones_fk',
    );
    expect(foreignKeyNames(scheduleBaselines)).toContain(
      'schedule_baselines_workspace_id_project_id_sign_off_id_sign_offs_workspace_id_project_id_id_fk',
    );
  });

  it('persists composite schedule relationship constraints in the migration', () => {
    const sql = scheduleMigrationSql();

    expect(sql).toContain(
      'CONSTRAINT "schedule_phases_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id")',
    );
    expect(sql).toContain(
      'CONSTRAINT "schedule_milestones_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id")',
    );
    expect(sql).toContain(
      'CONSTRAINT "sign_offs_workspace_id_project_id_id_unique" UNIQUE("workspace_id","project_id","id")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("workspace_id","project_id","phase_id") REFERENCES "public"."schedule_phases"("workspace_id","project_id","id")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("workspace_id","project_id","milestone_id") REFERENCES "public"."schedule_milestones"("workspace_id","project_id","id")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("workspace_id","project_id","sign_off_id") REFERENCES "public"."sign_offs"("workspace_id","project_id","id")',
    );
  });

  it('prevents negative baseline milestone display order', () => {
    expect(checkNames(scheduleBaselineMilestones)).toContain(
      'schedule_baseline_milestones_display_order_check',
    );
    expect(scheduleMigrationSql()).toContain(
      'CONSTRAINT "schedule_baseline_milestones_display_order_check" CHECK ("schedule_baseline_milestones"."display_order" >= 0)',
    );
  });
});
