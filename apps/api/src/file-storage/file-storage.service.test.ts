import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { WorkspaceContext } from '@materiabill/contracts';
import { describe, expect, it, vi } from 'vitest';

import { FileStorageService } from './file-storage.service.js';

const workspaceContext: WorkspaceContext = {
  workspace: {
    id: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
    name: 'Demo Workspace',
    slug: 'demo-workspace',
    paymentCurrency: 'SAR',
  },
  membership: {
    userId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
    roleKey: 'workspace_admin',
    permissions: ['workspace.view'],
    isAdmin: true,
  },
  access: {
    appInstalled: true,
    subscriptionActive: true,
    membershipActive: true,
  },
};

function createService() {
  const adapter = {
    putObject: vi.fn().mockResolvedValue({
      provider: 'local',
      key: 'stored-key',
    }),
  };
  const repository = {
    createAsset: vi.fn((input) =>
      Promise.resolve({
        id: input.id,
        workspaceId: input.workspaceId,
        purpose: input.purpose,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        createdAt: '2026-06-30T12:00:00.000Z',
      }),
    ),
  };
  const idFactory = vi.fn(() => '01890f8e-5f47-7cc3-98c4-dc0c0c07398f');
  const service = new FileStorageService(repository as never, adapter, {
    allowedMimeTypes: ['image/jpeg', 'application/pdf'],
    maxBytes: 1024,
    idFactory,
  });

  return { adapter, idFactory, repository, service };
}

describe('FileStorageService', () => {
  it('stores allowed uploads under a workspace-scoped key', async () => {
    const { adapter, repository, service } = createService();

    await expect(
      service.upload({
        workspaceContext,
        purpose: 'site_photo',
        file: {
          originalname: 'Progress Photo.JPG',
          mimetype: 'image/jpeg',
          size: 11,
          buffer: Buffer.from('image-bytes'),
        },
      }),
    ).resolves.toEqual({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      purpose: 'site_photo',
      originalFilename: 'Progress Photo.JPG',
      contentType: 'image/jpeg',
      sizeBytes: 11,
      checksumSha256: '2c8648d103e3dd7ad87660da0f126a1443b6d21ac1bd3ec000c5e24e2373a90c',
      createdAt: '2026-06-30T12:00:00.000Z',
    });

    expect(adapter.putObject).toHaveBeenCalledWith({
      key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/progress-photo.jpg',
      body: Buffer.from('image-bytes'),
      contentType: 'image/jpeg',
      originalFilename: 'Progress Photo.JPG',
      checksumSha256: '2c8648d103e3dd7ad87660da0f126a1443b6d21ac1bd3ec000c5e24e2373a90c',
    });
    expect(repository.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
        workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
        uploadedByUserId: '3f43835d-7f3b-4b16-907b-d57db49832dd',
        purpose: 'site_photo',
        storageProvider: 'local',
        storageKey: 'stored-key',
      }),
    );
  });

  it('uses a safe fallback filename for dot-only uploads', async () => {
    const { adapter, service } = createService();

    await service.upload({
      workspaceContext,
      purpose: 'generic',
      file: {
        originalname: '..',
        mimetype: 'image/jpeg',
        size: 11,
        buffer: Buffer.from('image-bytes'),
      },
    });

    expect(adapter.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'workspaces/82bf0afe-b730-4046-ac0b-30f74ce1db7a/uploads/01890f8e-5f47-7cc3-98c4-dc0c0c07398f/upload',
      }),
    );
  });

  it('rejects unknown upload purposes', async () => {
    const { service } = createService();

    await expect(
      service.upload({
        workspaceContext,
        purpose: 'avatar',
        file: {
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          size: 5,
          buffer: Buffer.from('image'),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects disallowed MIME types', async () => {
    const { service } = createService();

    await expect(
      service.upload({
        workspaceContext,
        purpose: 'generic',
        file: {
          originalname: 'script.js',
          mimetype: 'application/javascript',
          size: 5,
          buffer: Buffer.from('alert'),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects files larger than the configured limit', async () => {
    const { service } = createService();

    await expect(
      service.upload({
        workspaceContext,
        purpose: 'generic',
        file: {
          originalname: 'large.pdf',
          mimetype: 'application/pdf',
          size: 1025,
          buffer: Buffer.alloc(1025),
        },
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('maps adapter failures to a storage unavailable response', async () => {
    const { adapter, service } = createService();
    adapter.putObject.mockRejectedValue(new Error('spaces unavailable'));

    await expect(
      service.upload({
        workspaceContext,
        purpose: 'generic',
        file: {
          originalname: 'doc.pdf',
          mimetype: 'application/pdf',
          size: 3,
          buffer: Buffer.from('pdf'),
        },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
