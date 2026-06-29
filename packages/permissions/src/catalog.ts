export const bootstrapPermissions = ['bootstrap.read'] as const;

export type BootstrapPermissionName = (typeof bootstrapPermissions)[number];
