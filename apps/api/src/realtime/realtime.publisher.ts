import { Inject, Injectable } from '@nestjs/common';
import type { RealtimeEventEnvelope } from '@materiabill/contracts';

import { RealtimeHub } from './realtime.hub.js';
import type { PublishRealtimeEventInput } from './realtime.types.js';

@Injectable()
export class RealtimePublisher {
  constructor(@Inject(RealtimeHub) private readonly hub: RealtimeHub) {}

  publish(input: PublishRealtimeEventInput): RealtimeEventEnvelope {
    return this.hub.publish(input);
  }
}
