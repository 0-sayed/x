import { describe, expect, it } from 'vitest';

import {
  createPendingDecisionInputSchema,
  pendingDecisionListQuerySchema,
  pendingDecisionListResponseSchema,
  pendingDecisionSchema,
  undoPendingDecisionResponseSchema,
} from './grace-window.js';

describe('grace-window contracts', () => {
  it('accepts a pending decision response with countdown seconds', () => {
    const parsed = pendingDecisionSchema.parse({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      requestedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      status: 'pending',
      audience: 'participants',
      decisionType: 'signoff.approve',
      recordType: 'signoff',
      recordId: 'b78a2186-932e-43bb-a4c5-3853d4f9a0ff',
      summaryLabel: 'Approve timeline baseline',
      commitPayload: { signOffId: 'b78a2186-932e-43bb-a4c5-3853d4f9a0ff' },
      undoPayload: {},
      requestedAt: '2026-07-01T09:00:00.000Z',
      expiresAt: '2026-07-01T09:10:00.000Z',
      remainingSeconds: 600,
    });

    expect(parsed.status).toBe('pending');
    expect(parsed.audience).toBe('participants');
    expect(parsed.remainingSeconds).toBe(600);
  });

  it('accepts omitted creation grace minutes so workspace settings can supply the default', () => {
    expect(
      createPendingDecisionInputSchema.parse({
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        actorUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        audience: 'org',
        decisionType: 'draw.release',
        recordType: 'draw',
        recordId: 'b78a2186-932e-43bb-a4c5-3853d4f9a0ff',
        summaryLabel: 'Release draw D-104',
      }).graceWindowMinutes,
    ).toBeUndefined();
  });

  it('accepts list query filters and response payloads', () => {
    expect(
      pendingDecisionListQuerySchema.parse({
        projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
        limit: '25',
      }),
    ).toEqual({
      projectId: 'c5d9ed84-6469-4889-995d-cd38994fb7dd',
      limit: 25,
    });

    expect(
      pendingDecisionListResponseSchema.parse({
        decisions: [],
      }),
    ).toEqual({
      decisions: [],
    });
  });

  it('accepts undo responses and rejects invalid statuses', () => {
    expect(
      undoPendingDecisionResponseSchema.parse({
        decision: {
          id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
          workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
          projectId: null,
          requestedByUserId: null,
          status: 'undone',
          audience: 'client',
          decisionType: 'document.sign',
          recordType: 'document',
          recordId: null,
          summaryLabel: 'Sign handover certificate',
          commitPayload: {},
          undoPayload: {},
          requestedAt: '2026-07-01T09:00:00.000Z',
          expiresAt: '2026-07-01T09:10:00.000Z',
          remainingSeconds: 0,
        },
      }).decision.status,
    ).toBe('undone');

    expect(() =>
      pendingDecisionSchema.parse({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        projectId: null,
        requestedByUserId: null,
        status: 'expired',
        audience: 'client',
        decisionType: 'document.sign',
        recordType: 'document',
        recordId: null,
        summaryLabel: 'Sign handover certificate',
        commitPayload: {},
        undoPayload: {},
        requestedAt: '2026-07-01T09:00:00.000Z',
        expiresAt: '2026-07-01T09:10:00.000Z',
        remainingSeconds: 0,
      }),
    ).toThrow();
  });
});
