import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { HealthPayload } from '@materiabill/contracts';
import { getDatabaseHealth } from '@materiabill/db';

@ApiTags('bootstrap')
@Controller()
export class HealthController {
  @Get('/health')
  @ApiOperation({ summary: 'Return bootstrap health status.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        app: { type: 'string', example: 'materiabill-api' },
        status: { type: 'string', example: 'ok' },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'not-configured' },
          },
        },
      },
    },
  })
  getHealth(): HealthPayload {
    return {
      app: 'materiabill-api',
      status: 'ok',
      database: getDatabaseHealth(),
    };
  }
}
