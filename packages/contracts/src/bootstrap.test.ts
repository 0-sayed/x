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
      permissions: ['workspace.view', 'manage_roles'],
      database: {
        status: 'not-configured',
      },
    });

    expect(parsed.docsPath).toBe('/docs');
    expect(parsed.permissions).toEqual(['workspace.view', 'manage_roles']);
  });

  it('parses the contractor permission catalog', () => {
    const parsed = bootstrapPermissionCatalogSchema.parse(['workspace.view', 'projects.create']);

    expect(parsed).toEqual(['workspace.view', 'projects.create']);
  });

  it('rejects bootstrap-only permission leftovers', () => {
    expect(() => bootstrapPermissionCatalogSchema.parse(['bootstrap.read'])).toThrow();
  });
});
