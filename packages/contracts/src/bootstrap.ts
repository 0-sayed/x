import { z } from 'zod';

export const databaseHealthSchema = z.object({
  status: z.enum(['not-configured']),
});

export const bootstrapPermissionSchema = z.enum(['bootstrap.read']);

export const bootstrapPermissionCatalogSchema = z.array(bootstrapPermissionSchema);

export const bootstrapInfoSchema = z.object({
  name: z.string().trim().min(1),
  environment: z.enum(['development', 'test', 'production']),
  version: z.string().trim().min(1),
  docsPath: z.literal('/docs'),
  openApiPath: z.literal('/docs-json'),
  permissions: bootstrapPermissionCatalogSchema,
  database: databaseHealthSchema,
});

export const healthPayloadSchema = z.object({
  app: z.literal('materiabill-api'),
  status: z.literal('ok'),
  database: databaseHealthSchema,
});

export type DatabaseHealth = z.infer<typeof databaseHealthSchema>;
export type BootstrapPermission = z.infer<typeof bootstrapPermissionSchema>;
export type BootstrapInfo = z.infer<typeof bootstrapInfoSchema>;
export type HealthPayload = z.infer<typeof healthPayloadSchema>;
