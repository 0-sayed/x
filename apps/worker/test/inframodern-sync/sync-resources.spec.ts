import { describe, expect, it } from 'vitest';

import {
  getSyncResourceConfig,
  requiredSyncResources,
} from '../../src/inframodern-sync/sync-resources.js';

describe('sync resource registry', () => {
  it('registers only required T005 resources', () => {
    expect(requiredSyncResources).toEqual(['users', 'brands', 'locations', 'exchange-rates']);
  });

  it('maps resource names to Inframodern entities', () => {
    expect(getSyncResourceConfig('exchange-rates')).toMatchObject({
      resource: 'exchange-rates',
      entity: 'exchange-rates',
      projection: 'exchange_rate_refs',
    });
  });
});
