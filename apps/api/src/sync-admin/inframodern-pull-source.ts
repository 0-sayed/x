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
        let lastId: string | null = null;
        let items = await this.readResource(sql, resource, pullBatchSize, lastId);

        while (items.length > 0) {
          batches.push({
            resource,
            envelope: {
              items,
              correlationId: `pull:${resource}:${new Date().toISOString()}`,
              operationId: `pull:${resource}:${Date.now().toString()}:${lastId ?? 'start'}`,
              targetApp: 'materiabill',
            },
          });

          if (items.length < pullBatchSize) {
            break;
          }

          lastId = getRowId(items.at(-1), resource);
          items = await this.readResource(sql, resource, pullBatchSize, lastId);
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
    lastId: string | null,
  ): Promise<Record<string, unknown>[]> {
    switch (resource) {
      case 'users':
        return lastId
          ? sql`select * from users where id > ${lastId} order by id limit ${limit}`
          : sql`select * from users order by id limit ${limit}`;
      case 'brands':
        return lastId
          ? sql`select * from brands where id > ${lastId} order by id limit ${limit}`
          : sql`select * from brands order by id limit ${limit}`;
      case 'locations':
        return lastId
          ? sql`select * from locations where id > ${lastId} order by id limit ${limit}`
          : sql`select * from locations order by id limit ${limit}`;
      case 'exchange-rates':
        return lastId
          ? sql`select * from exchange_rates where id > ${lastId} order by id limit ${limit}`
          : sql`select * from exchange_rates order by id limit ${limit}`;
    }
  }
}

function getRowId(row: Record<string, unknown> | undefined, resource: SyncResource): string {
  if (typeof row?.id !== 'string' || row.id.trim() === '') {
    throw new Error(`${resource} pull row is missing id`);
  }

  return row.id;
}
