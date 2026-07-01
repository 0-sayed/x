import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { signOffs } from './signoffs.js';

describe('signOffs schema', () => {
  it('uses the stable sign_offs table name', () => {
    expect(getTableName(signOffs)).toBe('sign_offs');
  });

  it('defines required sign-off columns', () => {
    const columns = Object.values(getTableConfig(signOffs).columns).map((column) => column.name);
    expect(columns).toEqual([
      'id',
      'workspace_id',
      'project_id',
      'subject_type',
      'subject_id',
      'title',
      'summary',
      'assigned_audience',
      'required_action',
      'status',
      'requested_by_user_id',
      'resolved_by_user_id',
      'resolution_reason',
      'resolution_decision_id',
      'last_reminder_at',
      'reminder_count',
      'created_at',
      'updated_at',
      'resolved_at',
    ]);
  });

  it('adds workspace and portfolio query indexes', () => {
    const indexes = getTableConfig(signOffs)
      .indexes.map((index) => index.config.name)
      .sort();
    expect(indexes).toEqual([
      'sign_offs_requested_by_user_id_idx',
      'sign_offs_resolution_decision_id_idx',
      'sign_offs_resolved_by_user_id_idx',
      'sign_offs_workspace_assigned_status_idx',
      'sign_offs_workspace_project_status_created_at_idx',
      'sign_offs_workspace_status_created_at_idx',
      'sign_offs_workspace_subject_idx',
    ]);
  });

  it('adds enum and reject-reason checks to the generated migration', () => {
    const migrationSql = readFileSync(
      new URL('../../drizzle/0008_sign_offs.sql', import.meta.url),
      'utf8',
    );

    expect(migrationSql).toContain('CREATE TABLE "sign_offs"');
    expect(migrationSql).toContain("\"assigned_audience\" in ('org', 'participants', 'client')");
    expect(migrationSql).toContain("\"required_action\" in ('approve', 'sign')");
    expect(migrationSql).toContain("\"status\" in ('pending', 'approved', 'rejected', 'signed')");
    expect(migrationSql).toContain(
      '"status" != \'rejected\' OR nullif(trim("resolution_reason"), \'\') IS NOT NULL',
    );
  });
});
