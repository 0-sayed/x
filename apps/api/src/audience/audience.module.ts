import { Module } from '@nestjs/common';

import { AudienceService } from './audience.service.js';

@Module({
  providers: [AudienceService],
  exports: [AudienceService],
})
export class AudienceModule {}
