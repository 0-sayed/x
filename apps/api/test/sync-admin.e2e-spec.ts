import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { InframodernPullSource } from '../src/sync-admin/inframodern-pull-source.js';
import { SYNC_ADMIN_DB } from '../src/sync-admin/sync-admin.module.js';
import { SyncAdminRabbitMqService } from '../src/sync-admin/sync-admin-rabbitmq.service.js';

const unresolvedFailure = {
  id: '11111111-1111-4111-8111-111111111111',
  eventId: 'users:corr-1',
  resource: 'users',
  correlationId: 'corr-1',
  operationId: 'op-1',
  jobId: 'job-1',
  retryCount: 2,
  payload: {
    items: [{ id: 'user-1' }],
    correlationId: 'corr-1',
    operationId: 'op-1',
    jobId: 'job-1',
    targetApp: 'materiabill',
  },
  errorMessage: 'projection failed',
  errorStack: null,
  failedAt: new Date('2026-06-30T10:15:00.000Z'),
  resolvedAt: null,
};

describe('sync admin endpoints', () => {
  let restoreEnv: (() => void) | undefined;

  afterEach(() => {
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it('rejects retry when SYNC_ADMIN_TOKEN is not configured', async () => {
    const harness = await createApp({ SYNC_ADMIN_TOKEN: '' });
    restoreEnv = harness.restoreEnv;

    await request(harness.app.getHttpServer()).post('/sync/failures/failure-id/retry').expect(503);

    await harness.app.close();
  });

  it('rejects retry with the wrong admin token', async () => {
    const harness = await createApp({ SYNC_ADMIN_TOKEN: 'secret' });
    restoreEnv = harness.restoreEnv;

    await request(harness.app.getHttpServer())
      .post('/sync/failures/failure-id/retry')
      .set('x-sync-admin-token', 'wrong')
      .expect(401);

    await harness.app.close();
  });

  it('lists unresolved failures with ISO failedAt values', async () => {
    const db = createDbMock({
      findMany: vi.fn(() => Promise.resolve([unresolvedFailure])),
    });
    const harness = await createApp({ SYNC_ADMIN_TOKEN: 'secret' }, { db });
    restoreEnv = harness.restoreEnv;

    const response = await request(harness.app.getHttpServer())
      .get('/sync/failures')
      .set('x-sync-admin-token', 'secret')
      .expect(200);

    expect(response.body).toEqual([
      {
        id: unresolvedFailure.id,
        eventId: unresolvedFailure.eventId,
        resource: unresolvedFailure.resource,
        correlationId: unresolvedFailure.correlationId,
        operationId: unresolvedFailure.operationId,
        jobId: unresolvedFailure.jobId,
        retryCount: unresolvedFailure.retryCount,
        errorMessage: unresolvedFailure.errorMessage,
        failedAt: '2026-06-30T10:15:00.000Z',
      },
    ]);

    await harness.app.close();
  });

  it('republishes unresolved failures and increments retry count', async () => {
    const db = createDbMock({
      findFirst: vi.fn(() => Promise.resolve(unresolvedFailure)),
    });
    const rabbit = { publishEnvelope: vi.fn(() => Promise.resolve()) };
    const harness = await createApp({ SYNC_ADMIN_TOKEN: 'secret' }, { db, rabbit });
    restoreEnv = harness.restoreEnv;

    const response = await request(harness.app.getHttpServer())
      .post(`/sync/failures/${unresolvedFailure.id}/retry`)
      .set('x-sync-admin-token', 'secret')
      .expect(201);

    expect(response.body).toEqual({ status: 'queued', failureId: unresolvedFailure.id });
    expect(rabbit.publishEnvelope).toHaveBeenCalledWith('users', unresolvedFailure.payload);
    expect(db.incrementFailureRetryCount).toHaveBeenCalledWith(unresolvedFailure.id);

    await harness.app.close();
  });

  it('publishes pull batches and returns a queued summary', async () => {
    const firstEnvelope = {
      items: [{ id: 'brand-1' }],
      correlationId: 'pull:brands:2026-06-30T10:00:00.000Z',
      operationId: 'pull:brands:1',
      targetApp: 'materiabill',
    };
    const rabbit = { publishEnvelope: vi.fn(() => Promise.resolve()) };
    const pullSource = {
      readBatches: vi.fn(() => Promise.resolve([{ resource: 'brands', envelope: firstEnvelope }])),
    };
    const harness = await createApp(
      {
        SYNC_ADMIN_TOKEN: 'secret',
        INFRAMODERN_DB_URL: 'postgres://source_user:source_pass@127.0.0.1:5432/source',
      },
      { rabbit, pullSource },
    );
    restoreEnv = harness.restoreEnv;

    const response = await request(harness.app.getHttpServer())
      .post('/sync/pull')
      .set('x-sync-admin-token', 'secret')
      .send({ resources: ['brands'] })
      .expect(201);

    expect(response.body).toEqual({
      status: 'queued',
      resources: ['brands'],
      publishedMessages: 1,
    });
    expect(pullSource.readBatches).toHaveBeenCalledWith(
      'postgres://source_user:source_pass@127.0.0.1:5432/source',
      ['brands'],
    );
    expect(rabbit.publishEnvelope).toHaveBeenCalledWith('brands', firstEnvelope);

    await harness.app.close();
  });

  it('deduplicates pull resources before reading source batches', async () => {
    const rabbit = { publishEnvelope: vi.fn(() => Promise.resolve()) };
    const pullSource = {
      readBatches: vi.fn(() => Promise.resolve([])),
    };
    const harness = await createApp(
      {
        SYNC_ADMIN_TOKEN: 'secret',
        INFRAMODERN_DB_URL: 'postgres://source_user:source_pass@127.0.0.1:5432/source',
      },
      { rabbit, pullSource },
    );
    restoreEnv = harness.restoreEnv;

    const response = await request(harness.app.getHttpServer())
      .post('/sync/pull')
      .set('x-sync-admin-token', 'secret')
      .send({ resources: ['brands', 'users', 'brands'] })
      .expect(201);

    expect(response.body).toMatchObject({
      resources: ['brands', 'users'],
      publishedMessages: 0,
    });
    expect(pullSource.readBatches).toHaveBeenCalledWith(
      'postgres://source_user:source_pass@127.0.0.1:5432/source',
      ['brands', 'users'],
    );

    await harness.app.close();
  });

  it('does not retry poison failures marked with an unknown resource', async () => {
    const db = createDbMock({
      findFirst: vi.fn(() =>
        Promise.resolve({
          ...unresolvedFailure,
          resource: 'unknown',
          payload: { correlationId: 'unknown', items: [{ rawMessage: '{"items":' }] },
        }),
      ),
    });
    const rabbit = { publishEnvelope: vi.fn(() => Promise.resolve()) };
    const harness = await createApp({ SYNC_ADMIN_TOKEN: 'secret' }, { db, rabbit });
    restoreEnv = harness.restoreEnv;

    await request(harness.app.getHttpServer())
      .post(`/sync/failures/${unresolvedFailure.id}/retry`)
      .set('x-sync-admin-token', 'secret')
      .expect(404);

    expect(rabbit.publishEnvelope).not.toHaveBeenCalled();
    expect(db.incrementFailureRetryCount).not.toHaveBeenCalled();

    await harness.app.close();
  });

  it('rejects pull when INFRAMODERN_DB_URL is not configured', async () => {
    const harness = await createApp({ SYNC_ADMIN_TOKEN: 'secret', INFRAMODERN_DB_URL: '' });
    restoreEnv = harness.restoreEnv;

    await request(harness.app.getHttpServer())
      .post('/sync/pull')
      .set('x-sync-admin-token', 'secret')
      .expect(503);

    await harness.app.close();
  });

  it('restores env changes when app creation throws', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    Reflect.deleteProperty(process.env, 'SYNC_ADMIN_TOKEN');

    await expect(
      createApp(
        { SYNC_ADMIN_TOKEN: 'secret' },
        {
          beforeCompile: (builder) => {
            builder.overrideProvider(SyncAdminRabbitMqService).useFactory({
              factory: () => {
                throw new Error('compile failed');
              },
            });
          },
        },
      ),
    ).rejects.toThrow('compile failed');

    expect(process.env.NODE_ENV).toBe(previousNodeEnv);
    expect(process.env.SYNC_ADMIN_TOKEN).toBeUndefined();
  });
});

type DbMock = ReturnType<typeof createDbMock>;

type AppOverrides = {
  readonly db?: DbMock;
  readonly rabbit?: { readonly publishEnvelope: ReturnType<typeof vi.fn> };
  readonly pullSource?: { readonly readBatches: ReturnType<typeof vi.fn> };
  readonly beforeCompile?: (builder: TestingModuleBuilder) => void;
};

async function createApp(
  env: NodeJS.ProcessEnv,
  overrides: AppOverrides = {},
): Promise<{ readonly app: INestApplication; readonly restoreEnv: () => void }> {
  const previousEnv = { ...process.env };
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://api_user:api_pass@127.0.0.1:55432/materiabill';
  process.env.RABBITMQ_URL = 'amqp://local_user:local_pass@127.0.0.1:55672';
  process.env.RABBITMQ_ENVIRONMENT = 'testing';
  process.env.RABBITMQ_APP_CODE = 'materiabill';
  process.env.SESSION_SECRET = '12345678901234567890123456789012';
  process.env.SESSION_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
  process.env.INFRAMODERN_URL = 'http://inframodern.test';
  process.env.INFRAMODERN_FRONTEND_URL = 'http://frontend.test';
  process.env.ADMIN_URL = 'http://admin.test';
  process.env.INFRAMODERN_OAUTH_CLIENT_ID = 'client-id';
  process.env.INFRAMODERN_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.INFRAMODERN_OAUTH_CALLBACK_URL = 'http://api.test/auth/callback';
  Object.assign(process.env, env);

  const builder = Test.createTestingModule({ imports: [AppModule] });
  builder.overrideProvider(SYNC_ADMIN_DB).useValue(overrides.db ?? createDbMock());
  builder
    .overrideProvider(SyncAdminRabbitMqService)
    .useValue(overrides.rabbit ?? { publishEnvelope: vi.fn(() => Promise.resolve()) });
  builder
    .overrideProvider(InframodernPullSource)
    .useValue(overrides.pullSource ?? { readBatches: vi.fn(() => Promise.resolve([])) });
  overrides.beforeCompile?.(builder);

  try {
    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    return {
      app,
      restoreEnv,
    };
  } catch (error) {
    restoreEnv();
    throw error;
  }

  function restoreEnv(): void {
    for (const key of Object.keys(process.env)) {
      if (!(key in previousEnv)) {
        Reflect.deleteProperty(process.env, key);
      }
    }
    Object.assign(process.env, previousEnv);
  }
}

function createDbMock(
  overrides: { findMany?: ReturnType<typeof vi.fn>; findFirst?: ReturnType<typeof vi.fn> } = {},
) {
  return {
    query: {
      syncFailures: {
        findMany: overrides.findMany ?? vi.fn(() => Promise.resolve([])),
        findFirst: overrides.findFirst ?? vi.fn(() => Promise.resolve(undefined)),
      },
    },
    incrementFailureRetryCount: vi.fn(() => Promise.resolve()),
  };
}
