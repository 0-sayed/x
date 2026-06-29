import { describe, expect, it } from 'vitest';

import { WorkerHealthService } from '../src/worker-health.service.js';

describe('worker bootstrap shell', () => {
  it('reports a bootstrap-ready worker health payload', () => {
    const service = new WorkerHealthService();

    expect(service.getHealth()).toEqual({
      app: 'materiabill-worker',
      status: 'ok',
      queues: 'disabled',
    });
  });
});
