import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ClientIdentitiesRepository } from './client-identities.repository.js';
import { ClientIdentitiesService } from './client-identities.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ClientIdentitiesRepository, ClientIdentitiesService],
  exports: [ClientIdentitiesService],
})
export class ClientIdentitiesModule {}
