import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { pendingDecisions } from './grace-window.js';

describe('pendingDecisions schema', () => {
  it('uses workspace-scoped pending decision columns', () => {
    expect(pendingDecisions.id.name).toBe('id');
    expect(pendingDecisions.workspaceId.name).toBe('workspace_id');
    expect(pendingDecisions.projectId.name).toBe('project_id');
    expect(pendingDecisions.requestedByUserId.name).toBe('requested_by_user_id');
    expect(pendingDecisions.status.name).toBe('status');
    expect(pendingDecisions.audience.name).toBe('audience');
    expect(pendingDecisions.decisionType.name).toBe('decision_type');
    expect(pendingDecisions.recordType.name).toBe('record_type');
    expect(pendingDecisions.summaryLabel.name).toBe('summary_label');
    expect(pendingDecisions.commitPayload.name).toBe('commit_payload');
    expect(pendingDecisions.undoPayload.name).toBe('undo_payload');
    expect(pendingDecisions.expiresAt.name).toBe('expires_at');
  });

  it('enforces one pending decision per record identity', () => {
    const indexes = getTableConfig(pendingDecisions).indexes.map((index) => index.config.name);

    expect(indexes).toContain('pending_decisions_pending_record_unique_idx');
  });
});
