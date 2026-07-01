import type { AuditEventRecord } from '@materiabill/db';
import { describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service.js';

const row: AuditEventRecord = {
  id: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
  workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  actorUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
  audience: 'internal',
  action: 'workspace.switch',
  resourceType: 'workspace',
  resourceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  metadata: { source: 'workspace-switcher' },
  occurredAt: new Date('2026-06-30T12:00:00.000Z'),
};

function createService() {
  const repository = {
    insertEvent: vi.fn().mockResolvedValue(row),
    listEvents: vi.fn().mockResolvedValue([row]),
  };

  return {
    repository,
    service: new AuditService(repository as never),
  };
}

describe('AuditService', () => {
  it('records an event with default metadata and occurrence timestamp', async () => {
    const { repository, service } = createService();

    await expect(
      service.recordEvent({
        workspaceId: row.workspaceId,
        actorUserId: row.actorUserId,
        audience: 'internal',
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
      }),
    ).resolves.toEqual({
      ...row,
      occurredAt: '2026-06-30T12:00:00.000Z',
    });

    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: row.resourceId,
        metadata: {},
        occurredAt: expect.any(Date),
      }),
    );
  });

  it('records an event with null resourceId when omitted', async () => {
    const { repository, service } = createService();

    await service.recordEvent({
      workspaceId: row.workspaceId,
      actorUserId: row.actorUserId,
      audience: 'internal',
      action: row.action,
      resourceType: row.resourceType,
    });

    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: null,
      }),
    );
  });

  it('lists events and serializes dates for API responses', async () => {
    const { repository, service } = createService();

    await expect(
      service.listEvents({
        workspaceId: row.workspaceId,
        audience: 'internal',
        before: '2026-06-30T13:00:00.000Z',
        limit: 25,
      }),
    ).resolves.toEqual({
      events: [
        {
          ...row,
          occurredAt: '2026-06-30T12:00:00.000Z',
        },
      ],
    });

    expect(repository.listEvents).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      audience: 'internal',
      before: new Date('2026-06-30T13:00:00.000Z'),
      beforeId: undefined,
      limit: 25,
    });
  });

  it('passes the stable pagination cursor to the repository', async () => {
    const { repository, service } = createService();

    await service.listEvents({
      workspaceId: row.workspaceId,
      before: '2026-06-30T13:00:00.000Z',
      beforeId: row.id,
    });

    expect(repository.listEvents).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      audience: undefined,
      before: new Date('2026-06-30T13:00:00.000Z'),
      beforeId: row.id,
      limit: 50,
    });
  });

  it('defaults listEvents limit to 50 before calling the repository', async () => {
    const { repository, service } = createService();

    await service.listEvents({
      workspaceId: row.workspaceId,
    });

    expect(repository.listEvents).toHaveBeenCalledWith({
      workspaceId: row.workspaceId,
      audience: undefined,
      before: undefined,
      beforeId: undefined,
      limit: 50,
    });
  });

  it('rejects an invalid audience before calling the repository', async () => {
    const { repository, service } = createService();

    await expect(
      service.listEvents({
        workspaceId: row.workspaceId,
        audience: 'public',
      } as never),
    ).rejects.toThrow();

    expect(repository.listEvents).not.toHaveBeenCalled();
  });

  it('rejects an invalid before timestamp before calling the repository', async () => {
    const { repository, service } = createService();

    await expect(
      service.listEvents({
        workspaceId: row.workspaceId,
        before: 'not-a-timestamp',
      }),
    ).rejects.toThrow();

    expect(repository.listEvents).not.toHaveBeenCalled();
  });
});
