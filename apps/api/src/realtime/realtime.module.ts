import { Module } from '@nestjs/common';

import { SessionModule } from '../session/session.module.js';
import { WorkspaceContextModule } from '../workspace-context/workspace-context.module.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeHub } from './realtime.hub.js';
import { RealtimePublisher } from './realtime.publisher.js';

@Module({
  imports: [SessionModule, WorkspaceContextModule],
  controllers: [RealtimeController],
  providers: [RealtimeHub, RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
