import { z } from 'zod';

export const fileUploadPurposeSchema = z.enum(['generic', 'document', 'site_photo', 'logo']);

export const uploadedFileAssetSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    purpose: fileUploadPurposeSchema,
    originalFilename: z.string().trim().min(1),
    contentType: z.string().trim().min(1),
    sizeBytes: z.number().int().nonnegative(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type FileUploadPurpose = z.infer<typeof fileUploadPurposeSchema>;
export type UploadedFileAsset = z.infer<typeof uploadedFileAssetSchema>;
