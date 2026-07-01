import { Module } from '@nestjs/common';

import { PermissionsGuard } from './permissions.guard.js';
import { PermissionsRepository } from './permissions.repository.js';
import { PermissionsService } from './permissions.service.js';

@Module({
  providers: [PermissionsRepository],
  exports: [PermissionsRepository],
})
export class PermissionsDataModule {}

@Module({
  imports: [PermissionsDataModule],
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class PermissionsModule {}
