import type { SyncResource } from './sync.js';

export type SyncTopologyConfig = {
  readonly environmentName: string;
  readonly appCode: string;
};

export type SyncQueueOptions = {
  readonly durable: true;
  readonly arguments: {
    readonly 'x-dead-letter-exchange': string;
    readonly 'x-dead-letter-routing-key': string;
  };
};

export type SyncQueueTopology = {
  readonly queue: string;
  readonly routingKey: string;
  readonly deadLetterRoutingKey: string;
};

export type InframodernTopology = {
  readonly exchange: string;
  readonly deadLetterExchange: string;
  readonly completionRoutingKey: string;
  readonly queues: Record<SyncResource, SyncQueueTopology>;
  queueOptions(resource: SyncResource): SyncQueueOptions;
};

export function getInframodernTopology(
  config: SyncTopologyConfig,
  resources: readonly SyncResource[],
): InframodernTopology {
  const inframodernNamespace = `inframodern-${config.environmentName}`;
  const appNamespace = `${config.appCode}-${config.environmentName}`;
  const exchange = `x.${inframodernNamespace}`;
  const deadLetterExchange = `dlx.${inframodernNamespace}`;

  const queues = Object.fromEntries(
    resources.map((resource) => [
      resource,
      {
        queue: `q.${inframodernNamespace}.${appNamespace}.${resource}`,
        routingKey: `${inframodernNamespace}.${resource}`,
        deadLetterRoutingKey: `dead.${inframodernNamespace}.${resource}`,
      },
    ]),
  ) as Record<SyncResource, SyncQueueTopology>;

  return {
    exchange,
    deadLetterExchange,
    completionRoutingKey: `${appNamespace}.${inframodernNamespace}.sync-completion`,
    queues,
    queueOptions: (resource) => ({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': deadLetterExchange,
        'x-dead-letter-routing-key': queues[resource].deadLetterRoutingKey,
      },
    }),
  };
}
