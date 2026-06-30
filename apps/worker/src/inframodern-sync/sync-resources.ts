import type { SyncResource } from '@materiabill/contracts';

export type SyncResourceConfig = {
  readonly resource: SyncResource;
  readonly entity: string;
  readonly projection: string;
};

const resourceConfigs = {
  users: {
    resource: 'users',
    entity: 'users',
    projection: 'inframodern_user_refs',
  },
  brands: {
    resource: 'brands',
    entity: 'brands',
    projection: 'brand_refs',
  },
  locations: {
    resource: 'locations',
    entity: 'locations',
    projection: 'location_refs',
  },
  'exchange-rates': {
    resource: 'exchange-rates',
    entity: 'exchange-rates',
    projection: 'exchange_rate_refs',
  },
} satisfies Record<SyncResource, SyncResourceConfig>;

export const requiredSyncResources = Object.keys(resourceConfigs) as readonly SyncResource[];

export function getSyncResourceConfig(resource: SyncResource): SyncResourceConfig {
  return resourceConfigs[resource];
}
