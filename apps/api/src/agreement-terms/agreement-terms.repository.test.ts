import { describe, expect, it, vi } from 'vitest';

import { agreementTerms, projects } from '@materiabill/db';
import { AgreementTermsRepository } from './agreement-terms.repository.js';

function createDbMock(selectRows: readonly unknown[] = [], updateRows: readonly unknown[] = []) {
  const calls: unknown[] = [];
  const selectBuilder = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(() => Promise.resolve(selectRows)),
  };
  selectBuilder.from.mockReturnValue(selectBuilder);
  selectBuilder.where.mockReturnValue(selectBuilder);

  const db = {
    select: vi.fn(() => selectBuilder),
    insert: vi.fn((table: unknown) => {
      calls.push({ op: 'insert', table });
      return {
        values: vi.fn((values: unknown) => ({
          onConflictDoUpdate: vi.fn((config: unknown) => ({
            returning: vi.fn().mockResolvedValue([{ ...(values as object), config }]),
          })),
        })),
      };
    }),
    update: vi.fn((table: unknown) => {
      calls.push({ op: 'update', table });
      return {
        set: vi.fn((values: unknown) => ({
          where: vi.fn((condition: unknown) => ({
            returning: vi
              .fn()
              .mockResolvedValue(
                updateRows.length > 0 ? updateRows : [{ ...(values as object), condition }],
              ),
          })),
        })),
      };
    }),
  };

  return { calls, db, selectBuilder };
}

function collectLeaves(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)];
  }
  if (value instanceof Date) return [value.toISOString()];
  if (typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return Reflect.ownKeys(value).flatMap((key) =>
    collectLeaves((value as Record<PropertyKey, unknown>)[key], seen),
  );
}

describe('AgreementTermsRepository', () => {
  it('finds project rows inside the selected workspace', async () => {
    const project = {
      id: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      archivedAt: null,
    };
    const { db, selectBuilder } = createDbMock([project]);
    const repository = new AgreementTermsRepository({ db } as never);

    await expect(
      repository.findProject({
        workspaceId: project.workspaceId,
        projectId: project.id,
      }),
    ).resolves.toEqual(project);

    expect(selectBuilder.from).toHaveBeenCalledWith(projects);
    const conditionLeaves = collectLeaves(selectBuilder.where.mock.calls[0]?.[0]);
    expect(conditionLeaves).toContain(project.workspaceId);
    expect(conditionLeaves).toContain(project.id);
  });

  it('upserts one terms record per workspace project', async () => {
    const { calls, db } = createDbMock();
    const repository = new AgreementTermsRepository({ db } as never);

    await expect(
      repository.upsertTerms({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        commercialModel: 'lump_sum',
        currency: 'SAR',
        disclosureDepth: 'category',
        retentionPercentage: 5,
        billingCycle: 'monthly',
        contractValueMinor: 2_500_000,
        contractSnapshotMarkdown: '# Agreement Terms\n',
        contractSnapshotGeneratedAt: new Date('2026-07-02T09:00:00.000Z'),
        configuredByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      }),
    ).resolves.toEqual(expect.objectContaining({ commercialModel: 'lump_sum' }));

    expect(calls).toEqual([expect.objectContaining({ op: 'insert', table: agreementTerms })]);
  });

  it('locks unlocked terms for the approved draw item', async () => {
    const lockedAt = new Date('2026-07-02T09:15:00.000Z');
    const { calls, db } = createDbMock(
      [],
      [
        {
          projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
          lockedAt,
          lockedByDrawItemId: '9b2d8796-9258-4381-9330-7b861e073bf8',
        },
      ],
    );
    const repository = new AgreementTermsRepository({ db } as never);

    await expect(
      repository.lockForApprovedDraw({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        drawItemId: '9b2d8796-9258-4381-9330-7b861e073bf8',
        lockedByUserId: null,
        lockedAt,
      }),
    ).resolves.toEqual(expect.objectContaining({ lockedAt }));

    expect(calls).toEqual([expect.objectContaining({ op: 'update', table: agreementTerms })]);
  });
});
