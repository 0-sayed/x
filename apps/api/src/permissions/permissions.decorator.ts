import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@materiabill/contracts';

export const REQUIRED_PERMISSIONS_METADATA = 'materiabill:required_permissions';

export const RequirePermissions = (...permissions: readonly PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_METADATA, permissions);
