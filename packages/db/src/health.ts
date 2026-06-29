import type { DatabaseHealth } from '@materiabill/contracts';

export function getDatabaseHealth(): DatabaseHealth {
  return {
    status: 'not-configured',
  };
}
