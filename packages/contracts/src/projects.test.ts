import { describe, expect, it } from 'vitest';

import {
  createProjectRequestSchema,
  projectDetailSchema,
  projectListQuerySchema,
  replaceProjectParticipantsRequestSchema,
  updateProjectRequestSchema,
} from './projects.js';

const workspaceId = '82bf0afe-b730-4046-ac0b-30f74ce1db7a';
const projectId = 'c5d9ed84-6469-4889-995d-cd38994fb7dd';
const userId = '3f43835d-7f3b-4b16-907b-d57db49832dd';

describe('project contracts', () => {
  it('accepts create payloads with baseline delivery date and project fields', () => {
    expect(
      createProjectRequestSchema.parse({
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        status: 'on_plan',
        now: 'Structure works',
        bottleneck: 'Awaiting marble delivery',
        baselineDeliveryDate: '2026-12-15',
        pmUserId: userId,
        locationId: null,
        clientOrgId: null,
      }),
    ).toEqual({
      name: 'Villa A12',
      city: 'Riyadh',
      currency: 'SAR',
      status: 'on_plan',
      now: 'Structure works',
      bottleneck: 'Awaiting marble delivery',
      baselineDeliveryDate: '2026-12-15',
      pmUserId: userId,
      locationId: null,
      clientOrgId: null,
    });
  });

  it('does not allow baseline delivery date updates', () => {
    expect(() =>
      updateProjectRequestSchema.parse({
        baselineDeliveryDate: '2027-01-01',
      }),
    ).toThrow();
  });

  it('parses list filters and pagination defaults', () => {
    expect(
      projectListQuerySchema.parse({
        city: 'Riyadh',
        status: 'behind',
        role: 'as_subcontract',
        includeArchived: 'true',
        limit: '25',
        cursor: projectId,
      }),
    ).toEqual({
      city: 'Riyadh',
      status: 'behind',
      role: 'as_subcontract',
      includeArchived: true,
      limit: 25,
      cursor: projectId,
    });

    expect(projectListQuerySchema.parse({ includeArchived: 'false' }).includeArchived).toBe(false);
  });

  it('accepts participant replacement payloads with unique workspace users', () => {
    expect(
      replaceProjectParticipantsRequestSchema.parse({
        participants: [{ userId, roleLabel: 'Project Manager' }],
      }),
    ).toEqual({
      participants: [{ userId, roleLabel: 'Project Manager' }],
    });
  });

  it('accepts detailed project responses', () => {
    expect(
      projectDetailSchema.parse({
        id: projectId,
        workspaceId,
        name: 'Villa A12',
        city: 'Riyadh',
        currency: 'SAR',
        status: 'stale',
        now: null,
        bottleneck: null,
        baselineDeliveryDate: '2026-12-15',
        pmUserId: null,
        locationId: null,
        clientOrgId: null,
        archivedAt: null,
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-07-01T09:00:00.000Z',
        participantCount: 1,
        participants: [
          {
            projectId,
            workspaceId,
            userId,
            roleLabel: 'Project Manager',
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: '2026-07-01T09:00:00.000Z',
          },
        ],
      }).status,
    ).toBe('stale');
  });
});
