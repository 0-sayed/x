import { BadRequestException, type INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import type { CurrentSessionUser } from '@materiabill/contracts';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApiDocumentation } from '../src/main.js';
import { SessionController } from '../src/session/session.controller.js';
import { SessionGuard } from '../src/session/session.guard.js';
import { SessionService } from '../src/session/session.service.js';

const sessionUser: CurrentSessionUser = {
  id: '3f43835d-7f3b-4b16-907b-d57db49832dd',
  email: 'admin@example.com',
  displayName: 'Admin User',
  phone: null,
  avatarUrl: null,
  activeWorkspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
  workspaces: [
    {
      id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      roleKey: 'workspace_admin',
      permissions: ['workspace.view'],
      isAdmin: true,
    },
  ],
};

function setSessionTestEnv(): void {
  process.env.SESSION_SECRET = '12345678901234567890123456789012';
  process.env.SESSION_ENCRYPTION_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
  process.env.INFRAMODERN_URL = 'http://inframodern.test';
  process.env.INFRAMODERN_FRONTEND_URL = 'http://frontend.test';
  process.env.ADMIN_URL = 'http://admin.test';
  process.env.INFRAMODERN_OAUTH_CLIENT_ID = 'client-id';
  process.env.INFRAMODERN_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.INFRAMODERN_OAUTH_CALLBACK_URL = 'http://api.test/auth/callback';
  process.env.INFRAMODERN_OAUTH_MODE = 'sandbox';
  process.env.INFRAMODERN_SANDBOX_OAUTH_CLIENT_ID = 'sandbox-client-id';
  process.env.INFRAMODERN_SANDBOX_OAUTH_CLIENT_SECRET = 'sandbox-client-secret';
  process.env.INFRAMODERN_SANDBOX_OAUTH_CALLBACK_URL = 'http://api.test/auth/callback';
}

function joinSetCookieHeader(value: string | readonly string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  return value ? [...value].join(';') : '';
}

function requireLocation(value: string | undefined): string {
  expect(value).toEqual(expect.any(String));

  if (!value) {
    throw new Error('Missing redirect location');
  }

  return value;
}

function requireOauthState(location: string | undefined): string {
  const state = new URL(requireLocation(location)).searchParams.get('state');

  expect(state).toEqual(expect.any(String));

  if (!state) {
    throw new Error('Missing OAuth state');
  }

  return state;
}

setSessionTestEnv();

describe('api bootstrap shell', () => {
  let app: INestApplication;

  beforeAll(async () => {
    setSessionTestEnv();
    process.env.DATABASE_URL ??=
      'postgresql://local_user:changeme-local-only@127.0.0.1:55432/materiabill';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiDocumentation(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the health endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.app).toBe('materiabill-api');
  });

  it('serves the openapi document', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(response.body.openapi).toBeDefined();
    expect(response.body.paths['/health']).toBeDefined();
    expect(response.body.paths['/bootstrap']).toBeDefined();
  });

  it('serves bootstrap metadata with contractor permission catalog keys', async () => {
    const response = await request(app.getHttpServer()).get('/bootstrap').expect(200);

    expect(response.body.permissions).toContain('workspace.view');
    expect(response.body.permissions).toContain('manage_roles');
    expect(response.body.permissions).toContain('payables.pay');
    expect(response.body.permissions).not.toContain('draws.approve');
    expect(response.body.permissions).not.toContain('bootstrap.read');
  });

  it('serves the swagger ui shell', async () => {
    const response = await request(app.getHttpServer()).get('/docs').expect(200);

    expect(response.text).toContain('Swagger UI');
  });

  it('uses structured json logger settings for http bootstrap', () => {
    const options = getApiLoggerOptions(
      getApiRuntimeConfig({
        API_LOG_LEVEL: 'debug',
        APP_VERSION: '1.2.3',
        NODE_ENV: 'production',
      }),
    );

    expect(options.pinoHttp).toMatchObject({
      autoLogging: true,
      base: {
        environment: 'production',
        service: 'materiabill-api',
        version: '1.2.3',
      },
      level: 'debug',
      messageKey: 'message',
    });
  });
});

describe('session auth endpoints', () => {
  let authApp: INestApplication;
  const sessionService = {
    buildLoginRedirect: vi.fn(
      (state: string) =>
        `http://frontend.test/authenticate?client_id=client-id&redirect_uri=http%3A%2F%2Fapi.test%2Fauth%2Fcallback&response_type=code&scope=openid+profile+email&state=${state}`,
    ),
    handleCallback: vi.fn(
      (
        code: string | undefined,
        storedState: string | undefined,
        returnedState: string | undefined,
      ) => {
        if (!code) {
          throw new BadRequestException('Missing authorization code');
        }

        if (!storedState || !returnedState || storedState !== returnedState) {
          throw new BadRequestException('Invalid OAuth state');
        }

        return Promise.resolve({ sessionId: 'a3f0cf17-bfd5-4cd0-a664-3d15339cdab2' });
      },
    ),
    getCurrentUser: vi.fn((sessionId: string | undefined) => {
      if (!sessionId) {
        throw new UnauthorizedException('Not authenticated');
      }

      return Promise.resolve(sessionUser);
    }),
    refresh: vi.fn((sessionId: string | undefined) => {
      if (!sessionId) {
        throw new UnauthorizedException('Not authenticated');
      }

      return Promise.resolve(sessionUser);
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  beforeAll(async () => {
    setSessionTestEnv();

    const moduleRef = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: sessionService,
        },
        {
          provide: SessionGuard,
          useFactory: () => new SessionGuard(sessionService as never),
        },
      ],
    }).compile();

    authApp = moduleRef.createNestApplication();
    authApp.use(cookieParser(process.env.SESSION_SECRET));
    await authApp.init();
  });

  afterAll(async () => {
    await authApp.close();
  });

  it('redirects to Inframodern OAuth and stores only state in the browser cookie', async () => {
    const response = await request(authApp.getHttpServer()).get('/auth/login').expect(302);
    const setCookie = joinSetCookieHeader(response.headers['set-cookie']);

    expect(response.headers.location).toContain('http://frontend.test/authenticate?');
    expect(response.headers.location).toContain('state=');
    expect(setCookie).toContain('materiabill.oauth_state=');
    expect(setCookie).not.toContain('access-token');
    expect(setCookie).not.toContain('refresh-token');
  });

  it('creates a signed session cookie on callback and redirects to admin', async () => {
    const agent = request.agent(authApp.getHttpServer());
    const loginResponse = await agent.get('/auth/login').expect(302);
    const state = requireOauthState(loginResponse.headers.location);

    const callbackResponse = await agent
      .get('/auth/callback')
      .query({ code: 'code-1', state })
      .expect(302);
    const setCookie = joinSetCookieHeader(callbackResponse.headers['set-cookie']);

    expect(callbackResponse.headers.location).toBe('http://admin.test');
    expect(setCookie).toContain('materiabill.sid=');
    expect(setCookie).not.toContain('access-token');
    expect(setCookie).not.toContain('refresh-token');
  });

  it('rejects callback state mismatch', async () => {
    const agent = request.agent(authApp.getHttpServer());

    await agent.get('/auth/login').expect(302);
    await agent.get('/auth/callback').query({ code: 'code-1', state: 'wrong-state' }).expect(400);
  });

  it('rejects unauthenticated /user requests', async () => {
    await request(authApp.getHttpServer()).get('/user').expect(401);
  });

  it('returns the authenticated /user response', async () => {
    const agent = request.agent(authApp.getHttpServer());
    const loginResponse = await agent.get('/auth/login').expect(302);
    const state = requireOauthState(loginResponse.headers.location);

    await agent.get('/auth/callback').query({ code: 'code-1', state }).expect(302);

    const response = await agent.get('/user').expect(200);

    expect(response.body).toEqual(sessionUser);
  });

  it('refreshes and logs out the signed server-side session', async () => {
    const agent = request.agent(authApp.getHttpServer());
    const loginResponse = await agent.get('/auth/login').expect(302);
    const state = requireOauthState(loginResponse.headers.location);

    await agent.get('/auth/callback').query({ code: 'code-1', state }).expect(302);

    const refreshResponse = await agent.post('/auth/refresh').expect(201);

    expect(refreshResponse.body).toEqual(sessionUser);

    await agent.post('/auth/logout').expect(204);
    expect(sessionService.logout).toHaveBeenCalledWith('a3f0cf17-bfd5-4cd0-a664-3d15339cdab2');
  });
});
