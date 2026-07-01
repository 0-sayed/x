import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';

import { RequirePermissions } from '../permissions/permissions.decorator.js';
import { PermissionsGuard } from '../permissions/permissions.guard.js';
import { WorkspaceContext } from '../workspace-context/workspace-context.decorator.js';
import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(WorkspaceContextGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('defaults')
  @RequirePermissions('settings.view')
  getDefaults(@WorkspaceContext() workspaceContext: WorkspaceContextValue) {
    return this.settingsService.getWorkspaceSettings(workspaceContext.workspace.id);
  }

  @Patch('defaults')
  @RequirePermissions('settings.manage_defaults')
  updateDefaults(
    @WorkspaceContext() workspaceContext: WorkspaceContextValue,
    @Body() body: unknown,
  ) {
    return this.settingsService.updateWorkspaceSettings(workspaceContext.workspace.id, body);
  }
}
