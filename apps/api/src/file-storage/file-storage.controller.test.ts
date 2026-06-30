import { type CanActivate, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { WorkspaceContext as WorkspaceContextValue } from '@materiabill/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { WorkspaceContextGuard } from '../workspace-context/workspace-context.guard.js';
import { FileStorageController } from './file-storage.controller.js';
import { FileStorageService } from './file-storage.service.js';

const workspaceContext: WorkspaceContextValue = {
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

describe('FileStorageController', () => {
  let app: INestApplication;
  const service = {
    upload: vi.fn().mockResolvedValue({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      purpose: 'site_photo',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 11,
      checksumSha256: '2c8648d103e3dd7ad87660da0f126a1443b6d21ac1bd3ec000c5e24e2373a90c',
      createdAt: '2026-06-30T12:00:00.000Z',
    }),
  };
  const guard: CanActivate = {
    canActivate: (context: ExecutionContext): boolean => {
      const requestValue = context.switchToHttp().getRequest<{
        workspaceContext?: WorkspaceContextValue;
      }>();
      requestValue.workspaceContext = workspaceContext;

      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FileStorageController],
      providers: [{ provide: FileStorageService, useValue: service }],
    })
      .overrideGuard(WorkspaceContextGuard)
      .useValue(guard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a workspace-scoped multipart upload', async () => {
    service.upload.mockClear();

    const response = await request(app.getHttpServer())
      .post('/files')
      .field('purpose', 'site_photo')
      .attach('file', Buffer.from('image-bytes'), {
        filename: 'progress.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: '01890f8e-5f47-7cc3-98c4-dc0c0c07398f',
      workspaceId: '82bf0afe-b730-4046-ac0b-30f74ce1db7a',
      purpose: 'site_photo',
      originalFilename: 'progress.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 11,
      checksumSha256: '2c8648d103e3dd7ad87660da0f126a1443b6d21ac1bd3ec000c5e24e2373a90c',
      createdAt: '2026-06-30T12:00:00.000Z',
    });
    expect(service.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceContext,
        purpose: 'site_photo',
        file: expect.objectContaining({
          originalname: 'progress.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('image-bytes'),
        }),
      }),
    );
  });

  it('rejects uploads before buffering files over the configured size limit', async () => {
    service.upload.mockClear();

    await request(app.getHttpServer())
      .post('/files')
      .field('purpose', 'site_photo')
      .attach('file', Buffer.alloc(10_485_761), {
        filename: 'too-large.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);

    expect(service.upload).not.toHaveBeenCalled();
  });
});
