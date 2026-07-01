import { describe, expect, it } from 'vitest';

import { projectParticipants, projects } from './projects.js';

describe('projects schema', () => {
  it('uses workspace-scoped project columns', () => {
    expect(projects.id.name).toBe('id');
    expect(projects.workspaceId.name).toBe('workspace_id');
    expect(projects.name.name).toBe('name');
    expect(projects.city.name).toBe('city');
    expect(projects.currency.name).toBe('currency');
    expect(projects.status.name).toBe('status');
    expect(projects.now.name).toBe('now');
    expect(projects.bottleneck.name).toBe('bottleneck');
    expect(projects.baselineDeliveryDate.name).toBe('baseline_delivery_date');
    expect(projects.pmUserId.name).toBe('pm_user_id');
    expect(projects.locationId.name).toBe('location_id');
    expect(projects.clientOrgId.name).toBe('client_org_id');
    expect(projects.archivedAt.name).toBe('archived_at');
  });

  it('uses workspace-member participant columns', () => {
    expect(projectParticipants.projectId.name).toBe('project_id');
    expect(projectParticipants.workspaceId.name).toBe('workspace_id');
    expect(projectParticipants.userId.name).toBe('user_id');
    expect(projectParticipants.roleLabel.name).toBe('role_label');
  });
});
