import { Test } from '@nestjs/testing';
import { getApiLoggerOptions, getApiRuntimeConfig } from '@materiabill/config';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureApiDocumentation } from '../src/main.js';

describe('api bootstrap shell', () => {
  let app: Awaited<ReturnType<typeof Test.createTestingModule>> extends never
    ? never
    : import('@nestjs/common').INestApplication;

  beforeAll(async () => {
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
