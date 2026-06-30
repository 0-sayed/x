import { Injectable } from '@nestjs/common';
import type { SyncEnvelope, SyncResource } from '@materiabill/contracts';
import postgres from 'postgres';

export type PullBatch = {
  readonly resource: SyncResource;
  readonly envelope: SyncEnvelope;
};

const pullBatchSize = 1000;

@Injectable()
export class InframodernPullSource {
  async readBatches(url: string, resources: readonly SyncResource[]): Promise<PullBatch[]> {
    const sql = postgres(url);

    try {
      const batches: PullBatch[] = [];

      for (const resource of resources) {
        let offset = 0;
        let items = await this.readResource(sql, resource, pullBatchSize, offset);

        while (items.length > 0) {
          batches.push({
            resource,
            envelope: {
              items,
              correlationId: `pull:${resource}:${new Date().toISOString()}`,
              operationId: `pull:${resource}:${Date.now().toString()}:${offset.toString()}`,
              targetApp: 'materiabill',
            },
          });

          if (items.length < pullBatchSize) {
            break;
          }

          offset += pullBatchSize;
          items = await this.readResource(sql, resource, pullBatchSize, offset);
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
    limit: number,
    offset: number,
  ): Promise<Record<string, unknown>[]> {
    switch (resource) {
      case 'users':
        return sql`select * from users order by id limit ${limit} offset ${offset}`;
      case 'brands':
        return sql`select * from brands order by id limit ${limit} offset ${offset}`;
      case 'locations':
        return sql`select * from locations order by id limit ${limit} offset ${offset}`;
      case 'exchange-rates':
        return sql`select * from exchange_rates order by id limit ${limit} offset ${offset}`;
    }
  }
}
