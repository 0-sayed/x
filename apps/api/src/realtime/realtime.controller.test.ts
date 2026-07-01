import {
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import { of } from 'rxjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeHub } from './realtime.hub.js';

const workspaceContext: WorkspaceContextValue = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: 'workspace_admin',
    permissions: ['workspace.view'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

describe('RealtimeController', () => {
  let app: INestApplication;
  const hub = {
    subscribe: vi.fn(() =>
      of({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        type: 'realtime.connected',
        retry: 10000,
        data: {
          id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
          workspaceId: workspaceContext.workspace.id,
          type: 'realtime.connected',
          payload: {},
          occurredAt: '2026-07-01T12:00:00.000Z',
        },
      }),
    ),
  };
  const guard: CanActivate = {
    canActivate: (context: ExecutionContext): boolean => {
      const requestValue = context.switchToHttp().getRequest<{
        workspaceContext?: WorkspaceContextValue;
      }>();
      requestValue.workspaceContext = workspaceContext;

      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [{ provide: RealtimeHub, useValue: hub }],
    })
      .overrideGuard(WorkspaceContextGuard)
      .useValue(guard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('streams SSE events for the resolved workspace', async () => {
    hub.subscribe.mockClear();

    const response = await request(app.getHttpServer()).get('/realtime/events').expect(200);

    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('event: realtime.connected');
    expect(response.text).toContain('retry: 10000');
    expect(response.text).toContain(workspaceContext.workspace.id);
    expect(hub.subscribe).toHaveBeenCalledWith(workspaceContext.workspace.id);
  });

  it('rejects a missing workspace context before subscribing', () => {
    const controller = new RealtimeController(hub as never);

    expect(() => controller.stream(undefined)).toThrow(UnauthorizedException);
    expect(hub.subscribe).not.toHaveBeenCalledWith(undefined);
  });
});
