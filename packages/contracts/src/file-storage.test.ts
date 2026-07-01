import { describe, expect, it } from 'vitest';

import { fileUploadPurposeSchema, uploadedFileAssetSchema } from './file-storage.js';

describe('file storage contracts', () => {
  it('accepts the upload purposes used by backend storage consumers', () => {
    expect(fileUploadPurposeSchema.parse('generic')).toBe('generic');
    expect(fileUploadPurposeSchema.parse('document')).toBe('document');
    expect(fileUploadPurposeSchema.parse('site_photo')).toBe('site_photo');
    expect(fileUploadPurposeSchema.parse('logo')).toBe('logo');
  });

  it('rejects unknown upload purposes', () => {
    expect(() => fileUploadPurposeSchema.parse('avatar')).toThrow();
  });

  it('validates uploaded file asset responses', () => {
    expect(
      uploadedFileAssetSchema.parse({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        purpose: 'site_photo',
        originalFilename: 'progress.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        checksumSha256: 'a'.repeat(64),
        createdAt: '2026-06-30T12:00:00.000Z',
      }),
    ).toEqual({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      purpose: 'site_photo',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      createdAt: '2026-06-30T12:00:00.000Z',
    });
  });

  it('rejects invalid checksums', () => {
    expect(() =>
      uploadedFileAssetSchema.parse({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        purpose: 'site_photo',
        originalFilename: 'progress.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        checksumSha256: 'not-a-sha',
        createdAt: '2026-06-30T12:00:00.000Z',
      }),
    ).toThrow();
  });
});
