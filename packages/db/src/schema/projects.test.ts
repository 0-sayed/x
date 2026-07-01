import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { projectParticipants, projects } from './projects.js';

const foreignKeyNames = (table: typeof projects | typeof projectParticipants) =>
  getTableConfig(table)
    .foreignKeys.map((foreignKey) => foreignKey.getName())
    .sort();

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

  it('keeps audit and metadata columns on projects and participants', () => {
    const projectColumns = getTableColumns(projects);
    const participantColumns = getTableColumns(projectParticipants);

    expect(projectColumns.createdByUserId.name).toBe('created_by_user_id');
    expect(projectColumns.archivedAt.name).toBe('archived_at');
    expect(projectColumns.createdAt.name).toBe('created_at');
    expect(projectColumns.createdAt.notNull).toBe(true);
    expect(projectColumns.updatedAt.name).toBe('updated_at');
    expect(projectColumns.updatedAt.notNull).toBe(true);
    expect(participantColumns.createdAt.name).toBe('created_at');
    expect(participantColumns.createdAt.notNull).toBe(true);
    expect(participantColumns.updatedAt.name).toBe('updated_at');
    expect(participantColumns.updatedAt.notNull).toBe(true);
  });

  it('enforces project workspace consistency for project managers and locations', () => {
    expect(foreignKeyNames(projects)).toEqual(
      expect.arrayContaining([
        'projects_workspace_id_pm_user_id_workspace_membership_refs_workspace_id_user_id_fk',
        'projects_workspace_id_location_id_location_refs_workspace_id_id_fk',
      ]),
    );
  });

  it('uses composite participant foreign keys without redundant single-column references', () => {
    expect(foreignKeyNames(projectParticipants)).toEqual([
      'project_participants_workspace_id_project_id_projects_workspace_id_id_fk',
      'project_participants_workspace_id_user_id_workspace_membership_refs_workspace_id_user_id_fk',
    ]);
  });
});
