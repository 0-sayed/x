import { getTableColumns, getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { auditEvents } from './audit.js';

describe('audit schema', () => {
  it('uses the stable audit_events table name', () => {
    expect(getTableName(auditEvents)).toBe('audit_events');
  });

  it('keeps audit event columns explicit', () => {
    expect(Object.keys(getTableColumns(auditEvents))).toEqual([
      'id',
      'workspaceId',
      'actorUserId',
      'audience',
      'action',
      'resourceType',
      'resourceId',
      'metadata',
      'occurredAt',
    ]);
  });

  it('adds query indexes for workspace history and audience filtering', () => {
    expect(
      getTableConfig(auditEvents)
        .indexes.map((index) => index.config.name)
        .sort(),
    ).toEqual([
      'audit_events_workspace_audience_occurred_at_idx',
      'audit_events_workspace_occurred_at_idx',
    ]);
  });

  it('constrains audience to the allowed database values', () => {
    expect(getTableConfig(auditEvents).checks.map((check) => check.name)).toEqual([
      'audit_events_audience_check',
    ]);
  });
});
