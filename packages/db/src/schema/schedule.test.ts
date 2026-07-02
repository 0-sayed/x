import { getTableName } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  milestoneDrawLinks,
  scheduleBaselineMilestones,
  scheduleBaselines,
  scheduleForecastMoves,
  scheduleMilestones,
  schedulePhases,
} from './schedule.js';

describe('schedule schema', () => {
  it('exports schedule tables with stable table names', () => {
    expect(getTableName(schedulePhases)).toBe('schedule_phases');
    expect(getTableName(scheduleMilestones)).toBe('schedule_milestones');
    expect(getTableName(scheduleForecastMoves)).toBe('schedule_forecast_moves');
    expect(getTableName(scheduleBaselines)).toBe('schedule_baselines');
    expect(getTableName(scheduleBaselineMilestones)).toBe('schedule_baseline_milestones');
    expect(getTableName(milestoneDrawLinks)).toBe('milestone_draw_links');
  });
});
