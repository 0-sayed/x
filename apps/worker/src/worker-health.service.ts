import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkerHealthService {
  getHealth() {
    return {
      app: 'materiabill-worker',
      status: 'ok' as const,
      queues: 'disabled' as const,
    };
  }
}
