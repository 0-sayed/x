import { describe, expect, it } from 'vitest';

import { getInframodernTopology } from './sync-topology.js';

describe('Inframodern RabbitMQ topology', () => {
  it('uses the contracted exchange, dlx, queue, and routing names', () => {
    const topology = getInframodernTopology(
      { environmentName: 'testing', appCode: 'materiabill' },
      ['users', 'brands', 'locations', 'exchange-rates'],
    );

    expect(topology.exchange).toBe('x.inframodern-testing');
    expect(topology.deadLetterExchange).toBe('dlx.inframodern-testing');
    expect(topology.completionRoutingKey).toBe(
      'materiabill-testing.inframodern-testing.sync-completion',
    );
    expect(topology.queues.locations).toEqual({
      queue: 'q.inframodern-testing.materiabill-testing.locations',
      routingKey: 'inframodern-testing.locations',
      deadLetterRoutingKey: 'dead.inframodern-testing.locations',
    });
  });

  it('sets durable queue options with dead lettering', () => {
    const topology = getInframodernTopology(
      { environmentName: 'testing', appCode: 'materiabill' },
      ['users', 'brands', 'locations', 'exchange-rates'],
    );

    expect(topology.queueOptions('users')).toEqual({
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'dlx.inframodern-testing',
        'x-dead-letter-routing-key': 'dead.inframodern-testing.users',
      },
    });
  });
});
