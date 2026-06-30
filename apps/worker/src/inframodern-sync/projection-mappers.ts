import type {
  NewBrandRef,
  NewExchangeRateRef,
  NewInframodernUserRef,
  NewLocationRef,
  NewWorkspaceMembershipRef,
  NewWorkspaceRef,
} from '@materiabill/db';
import type { SyncResource } from '@materiabill/contracts';

type RawItem = Record<string, unknown>;

export type ProjectionBatch = {
  readonly users: NewInframodernUserRef[];
  readonly workspaces: NewWorkspaceRef[];
  readonly memberships: NewWorkspaceMembershipRef[];
  readonly brands: NewBrandRef[];
  readonly locations: NewLocationRef[];
  readonly exchangeRates: NewExchangeRateRef[];
};

const emptyBatch = (): ProjectionBatch => ({
  users: [],
  workspaces: [],
  memberships: [],
  brands: [],
  locations: [],
  exchangeRates: [],
});

export function mapProjectionBatch(
  resource: SyncResource,
  items: readonly Record<string, unknown>[],
): ProjectionBatch {
  const batch = emptyBatch();

  for (const item of items) {
    switch (resource) {
      case 'users':
        mapUser(batch, item);
        break;
      case 'brands':
        batch.brands.push(mapBrand(item));
        break;
      case 'locations':
        batch.locations.push(mapLocation(item));
        break;
      case 'exchange-rates':
        batch.exchangeRates.push(mapExchangeRate(item));
        break;
    }
  }

  return {
    users: dedupeByLastOccurrence(batch.users, (user) => user.id),
    workspaces: dedupeByLastOccurrence(batch.workspaces, (workspace) => workspace.id),
    memberships: dedupeByLastOccurrence(
      batch.memberships,
      (membership) => `${membership.workspaceId}::${membership.userId}`,
    ),
    brands: dedupeByLastOccurrence(batch.brands, (brand) => brand.id),
    locations: dedupeByLastOccurrence(batch.locations, (location) => location.id),
    exchangeRates: dedupeByLastOccurrence(batch.exchangeRates, (rate) => rate.id),
  };
}

function mapUser(batch: ProjectionBatch, item: Record<string, unknown>): void {
  const rawItem = asRawItem(item);
  const userId = requireString(rawItem, 'id', 'users');

  batch.users.push({
    id: userId,
    email: requireString(rawItem, 'email', 'users'),
    displayName: optionalString(rawItem.displayName) ?? optionalString(rawItem.name),
    phone: optionalString(rawItem.phone),
    avatarUrl: optionalString(rawItem.avatarUrl),
    locale: optionalString(rawItem.locale),
    deletedAt: optionalDate(rawItem.deletedAt),
    rawPayload: rawItem,
  });

  for (const workspaceItem of getArrayItems(rawItem.workspaces)) {
    batch.workspaces.push(mapWorkspace(workspaceItem));
    batch.memberships.push(mapMembership(userId, workspaceItem, false));
  }

  for (const workspaceItem of getArrayItems(rawItem.adminWorkspaces)) {
    batch.workspaces.push(mapWorkspace(workspaceItem));
    batch.memberships.push(mapMembership(userId, workspaceItem, true));
  }
}

function mapWorkspace(item: RawItem): NewWorkspaceRef {
  return {
    id: requireString(item, 'id', 'users'),
    name: requireString(item, 'name', 'users'),
    slug: optionalString(item.slug),
    paymentCurrency: optionalString(item.paymentCurrency),
    deletedAt: optionalDate(item.deletedAt),
    rawPayload: item,
  };
}

function mapMembership(userId: string, item: RawItem, isAdmin: boolean): NewWorkspaceMembershipRef {
  return {
    workspaceId: requireString(item, 'id', 'users'),
    userId,
    roleKey: optionalString(item.role) ?? optionalString(item.roleKey),
    permissions: getPermissions(item.permissions),
    isAdmin,
    isActive: optionalBoolean(item.isActive) ?? true,
    rawPayload: item,
    deletedAt: optionalDate(item.deletedAt),
  };
}

function mapBrand(item: Record<string, unknown>): NewBrandRef {
  const rawItem = asRawItem(item);

  return {
    id: requireString(rawItem, 'id', 'brands'),
    workspaceId: optionalString(rawItem.workspaceId),
    name: requireString(rawItem, 'name', 'brands'),
    accentColor: optionalString(rawItem.accentColor),
    logoUrl: optionalString(rawItem.logoUrl),
    customDomain: optionalString(rawItem.customDomain),
    deletedAt: optionalDate(rawItem.deletedAt),
    rawPayload: rawItem,
  };
}

function mapLocation(item: Record<string, unknown>): NewLocationRef {
  const rawItem = asRawItem(item);

  return {
    id: requireString(rawItem, 'id', 'locations'),
    workspaceId: optionalString(rawItem.workspaceId),
    name: requireString(rawItem, 'name', 'locations'),
    addressLine1: optionalString(rawItem.addressLine1),
    addressLine2: optionalString(rawItem.addressLine2),
    city: optionalString(rawItem.city),
    region: optionalString(rawItem.region),
    countryCode: optionalString(rawItem.countryCode),
    latitude: optionalNumeric(rawItem.latitude),
    longitude: optionalNumeric(rawItem.longitude),
    deletedAt: optionalDate(rawItem.deletedAt),
    rawPayload: rawItem,
  };
}

function mapExchangeRate(item: Record<string, unknown>): NewExchangeRateRef {
  const rawItem = asRawItem(item);

  return {
    id: requireString(rawItem, 'id', 'exchange-rates'),
    baseCurrency: requireString(rawItem, 'baseCurrency', 'exchange-rates'),
    quoteCurrency: requireString(rawItem, 'quoteCurrency', 'exchange-rates'),
    rate: requireNumeric(rawItem, 'rate', 'exchange-rates'),
    effectiveAt: requireDate(rawItem, 'effectiveAt', 'exchange-rates'),
    source: optionalString(rawItem.source),
    deletedAt: optionalDate(rawItem.deletedAt),
    rawPayload: rawItem,
  };
}

function asRawItem(item: Record<string, unknown>): RawItem {
  return item;
}

function getArrayItems(value: unknown): RawItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RawItem => typeof item === 'object' && item !== null);
}

function getPermissions(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function optionalNumeric(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }

  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function requireNumeric(item: RawItem, key: string, resource: SyncResource): string {
  const value = optionalNumeric(item[key]);
  if (value === null) {
    throw new Error(`${resource} item is missing ${key}`);
  }
  return value;
}

function requireDate(item: RawItem, key: string, resource: SyncResource): Date {
  const value = optionalDate(item[key]);
  if (value === null) {
    throw new Error(`${resource} item is missing ${key}`);
  }
  return value;
}

function requireString(item: RawItem, key: string, resource: SyncResource): string {
  const value = item[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${resource} item is missing ${key}`);
  }
  return value;
}

function optionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dedupeByLastOccurrence<T>(rows: readonly T[], getKey: (row: T) => string): T[] {
  const deduped: T[] = [];
  const seen = new Set<string>();

  for (const row of [...rows].reverse()) {
    const key = getKey(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.unshift(row);
  }

  return deduped;
}
