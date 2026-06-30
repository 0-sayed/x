import { Injectable } from '@nestjs/common';
import type { SyncEnvelope, SyncResource } from '@materiabill/contracts';
import postgres from 'postgres';

export type PullBatch = {
  readonly resource: SyncResource;
  readonly envelope: SyncEnvelope;
};

@Injectable()
export class InframodernPullSource {
  async readBatches(url: string, resources: readonly SyncResource[]): Promise<PullBatch[]> {
    const sql = postgres(url);

    try {
      const batches: PullBatch[] = [];

      for (const resource of resources) {
        const items = await this.readResource(sql, resource);

        if (items.length > 0) {
          batches.push({
            resource,
            envelope: {
              items,
              correlationId: `pull:${resource}:${new Date().toISOString()}`,
              operationId: `pull:${resource}:${Date.now().toString()}`,
              targetApp: 'materiabill',
            },
          });
        }
      }

      return batches;
    } finally {
      await sql.end();
    }
  }

  private async readResource(
    sql: postgres.Sql,
    resource: SyncResource,
  ): Promise<Record<string, unknown>[]> {
    switch (resource) {
      case 'users':
        return sql`select * from users`;
      case 'brands':
        return sql`select * from brands`;
      case 'locations':
        return sql`select * from locations`;
      case 'exchange-rates':
        return sql`select * from exchange_rates`;
    }
  }
}
