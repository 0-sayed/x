import { describe, expect, it } from 'vitest';

import { bootstrapInfoSchema, bootstrapPermissionCatalogSchema } from './bootstrap.js';

describe('bootstrap contract', () => {
  it('parses bootstrap info payloads', () => {
    const parsed = bootstrapInfoSchema.parse({
      name: 'materiabill-api',
      environment: 'test',
      version: '0.0.0-bootstrap',
      docsPath: '/docs',
      openApiPath: '/docs-json',
      permissions: ['bootstrap.read'],
      database: {
        status: 'not-configured',
      },
    });

    expect(parsed.docsPath).toBe('/docs');
    expect(parsed.permissions).toEqual(['bootstrap.read']);
  });

  it('parses the bootstrap permission catalog', () => {
    const parsed = bootstrapPermissionCatalogSchema.parse(['bootstrap.read']);

    expect(parsed).toEqual(['bootstrap.read']);
  });
});
