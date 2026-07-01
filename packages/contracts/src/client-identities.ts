import { z } from 'zod';

export const clientIdentityIdSchema = z.uuid();
export const clientIdentityEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
export const clientIdentityPhoneE164Schema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/);
export const clientIdentityNameSchema = z.string().trim().min(1).max(160);
export const verifiedTimestampSchema = z.iso.datetime();

export const clientIdentityContactSchema = z
  .object({
    email: clientIdentityEmailSchema.optional(),
    phoneE164: clientIdentityPhoneE164Schema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.email && !value.phoneE164) {
      ctx.addIssue({
        code: 'custom',
        message: 'Email or phone is required',
      });
    }
  });

export const createClientIdentityRequestSchema = z
  .object({
    displayName: clientIdentityNameSchema,
    email: clientIdentityEmailSchema.optional(),
    phoneE164: clientIdentityPhoneE164Schema.optional(),
    verifiedEmailAt: verifiedTimestampSchema.optional(),
    verifiedPhoneAt: verifiedTimestampSchema.optional(),
    inframodernUserId: z.uuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.email && !value.phoneE164) {
      ctx.addIssue({
        code: 'custom',
        message: 'Email or phone is required',
      });
    }
    if (value.email && !value.verifiedEmailAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Verified email timestamp is required',
      });
    }
    if (value.phoneE164 && !value.verifiedPhoneAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'Verified phone timestamp is required',
      });
    }
  });

export const clientIdentitySchema = z
  .object({
    id: clientIdentityIdSchema,
    displayName: clientIdentityNameSchema,
    email: clientIdentityEmailSchema.nullable(),
    phoneE164: clientIdentityPhoneE164Schema.nullable(),
    verifiedEmailAt: verifiedTimestampSchema.nullable(),
    verifiedPhoneAt: verifiedTimestampSchema.nullable(),
    inframodernUserId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type ClientIdentityId = z.infer<typeof clientIdentityIdSchema>;
export type ClientIdentityContact = z.infer<typeof clientIdentityContactSchema>;
export type CreateClientIdentityRequest = z.infer<typeof createClientIdentityRequestSchema>;
export type ClientIdentity = z.infer<typeof clientIdentitySchema>;
