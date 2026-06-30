import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { syncPullRequestSchema } from '@materiabill/contracts';

import { SyncAdminService } from './sync-admin.service.js';
import { SyncAdminTokenGuard } from './sync-admin-token.guard.js';

@Controller('sync')
@UseGuards(SyncAdminTokenGuard)
export class SyncAdminController {
  constructor(@Inject(SyncAdminService) private readonly syncAdmin: SyncAdminService) {}

  @Get('failures')
  listFailures() {
    return this.syncAdmin.listFailures();
  }

  @Post('failures/:failureId/retry')
  retryFailure(@Param('failureId') failureId: string) {
    return this.syncAdmin.retryFailure(failureId);
  }

  @Post('pull')
  pull(@Body() body: unknown) {
    const parsed = syncPullRequestSchema.safeParse(body ?? {});

    if (!parsed.success) {
      throw new BadRequestException('Invalid sync pull request');
    }

    return this.syncAdmin.pull(parsed.data);
  }
}
