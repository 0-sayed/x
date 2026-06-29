import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { BootstrapInfo } from '@materiabill/contracts';
import { getApiRuntimeConfig } from '@materiabill/config';
import { getDatabaseHealth } from '@materiabill/db';
import { bootstrapPermissions } from '@materiabill/permissions';

@ApiTags('bootstrap')
@Controller()
export class BootstrapInfoController {
  @Get('/bootstrap')
  @ApiOperation({ summary: 'Return bootstrap runtime metadata.' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'materiabill-api' },
        environment: { type: 'string', example: 'development' },
        version: { type: 'string', example: '0.0.0-bootstrap' },
        docsPath: { type: 'string', example: '/docs' },
        openApiPath: { type: 'string', example: '/docs-json' },
        permissions: {
          type: 'array',
          items: { type: 'string', example: 'bootstrap.read' },
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'not-configured' },
          },
        },
      },
    },
  })
  getBootstrapInfo(): BootstrapInfo {
    const config = getApiRuntimeConfig(process.env);

    return {
      name: config.appName,
      environment: config.environment,
      version: config.version,
      docsPath: '/docs',
      openApiPath: '/docs-json',
      permissions: [...bootstrapPermissions],
      database: getDatabaseHealth(),
    };
  }
}
