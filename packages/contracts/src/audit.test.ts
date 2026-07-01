import { describe, expect, it } from 'vitest';

import {
  auditEventListResponseSchema,
  auditEventQuerySchema,
  auditEventSchema,
  createAuditEventInputSchema,
} from './audit.js';

describe('audit contracts', () => {
  it('accepts an audit event response payload', () => {
    const parsed = auditEventSchema.parse({
      id: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      actorUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
      audience: 'internal',
      action: 'workspace.switch',
      resourceType: 'workspace',
      resourceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      metadata: { source: 'workspace-switcher' },
      occurredAt: '2026-06-30T12:00:00.000Z',
    });

    expect(parsed.audience).toBe('internal');
    expect(parsed.metadata).toEqual({ source: 'workspace-switcher' });
  });

  it('accepts nullable actor and resource ids for system-level events', () => {
    const parsed = createAuditEventInputSchema.parse({
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      actorUserId: null,
      audience: 'client',
      action: 'grace_window.expired',
      resourceType: 'pending_decision',
      resourceId: null,
      metadata: {},
    });

    expect(parsed.actorUserId).toBeNull();
    expect(parsed.resourceId).toBeNull();
  });

  it('defaults query limit and rejects unsupported audiences', () => {
    expect(auditEventQuerySchema.parse({})).toEqual({ limit: 50 });
    expect(auditEventQuerySchema.parse({ audience: 'client', limit: '25' })).toEqual({
      audience: 'client',
      limit: 25,
    });

    expect(() => auditEventQuerySchema.parse({ audience: 'public' })).toThrow();
  });

  it('accepts a stable pagination cursor only with its timestamp', () => {
    expect(
      auditEventQuerySchema.parse({
        before: '2026-06-30T13:00:00.000Z',
        beforeId: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
      }),
    ).toEqual({
      before: '2026-06-30T13:00:00.000Z',
      beforeId: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
      limit: 50,
    });

    expect(() =>
      auditEventQuerySchema.parse({
        beforeId: '98d9e64c-7686-4e40-91ce-3f861fd169e5',
      }),
    ).toThrow();
  });

  it('rejects unknown response fields and out-of-range limits', () => {
    expect(() =>
      auditEventListResponseSchema.parse({
        events: [],
        nextCursor: 'not-in-contract',
      }),
    ).toThrow();

    expect(() => auditEventQuerySchema.parse({ limit: '101' })).toThrow();
  });
});
