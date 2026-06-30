import { createHash } from 'node:crypto';

import type { SyncEnvelope, SyncResource } from '@materiabill/contracts';

function getDigest(parts: readonly string[]): string {
  const hash = createHash('sha256');

  for (const part of parts) {
    hash.update(part);
  }

  return hash.digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function getSyncEventId(resource: SyncResource, envelope: SyncEnvelope): string {
  if (envelope.operationId) {
    return envelope.operationId;
  }

  const digest = getDigest([resource, envelope.correlationId, canonicalJson(envelope.items)]);

  return `derived:${resource}:${digest}`;
}

export function getPoisonSyncEventId(resource: SyncResource, rawMessage: string): string {
  const digest = getDigest([resource, rawMessage]);

  return `poison:${resource}:${digest}`;
}
