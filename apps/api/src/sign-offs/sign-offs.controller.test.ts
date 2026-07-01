import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

import { REQUIRED_PERMISSIONS_METADATA } from '../permissions/permissions.decorator.js';
import { SignOffsController } from './sign-offs.controller.js';

const requiredPermissionsFor = (methodName: keyof SignOffsController) =>
  Reflect.getMetadata(REQUIRED_PERMISSIONS_METADATA, SignOffsController.prototype[methodName]);

describe('SignOffsController', () => {
  it('declares route permissions', () => {
    expect(requiredPermissionsFor('listSignOffs')).toEqual(['signoffs.view']);
    expect(requiredPermissionsFor('respondToSignOff')).toEqual(['signoffs.respond']);
    expect(requiredPermissionsFor('sendReminder')).toEqual(['signoffs.remind']);
  });

  it('requires workspace context for listing', async () => {
    const controller = new SignOffsController({ listSignOffs: vi.fn() } as never);

    await expect(controller.listSignOffs(undefined, {})).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid list query values', async () => {
    const controller = new SignOffsController({ listSignOffs: vi.fn() } as never);

    await expect(
      controller.listSignOffs(
        {
          workspace: { id: '22222222-2222-4222-8222-222222222222' },
          membership: { userId: '44444444-4444-4444-8444-444444444444' },
        } as never,
        { status: 'closed' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists sign-offs in the resolved workspace', async () => {
    const service = {
      listSignOffs: vi.fn().mockResolvedValue({ signOffs: [] }),
    };
    const controller = new SignOffsController(service as never);

    await expect(
      controller.listSignOffs(
        {
          workspace: { id: '22222222-2222-4222-8222-222222222222' },
          membership: { userId: '44444444-4444-4444-8444-444444444444' },
        } as never,
        { status: 'pending', limit: '25' },
      ),
    ).resolves.toEqual({ signOffs: [] });

    expect(service.listSignOffs).toHaveBeenCalledWith({
      workspaceId: '22222222-2222-4222-8222-222222222222',
      status: 'pending',
      limit: 25,
    });
  });

  it('requires workspace context for responding', async () => {
    const controller = new SignOffsController({
      requestResolution: vi.fn(),
    } as never);

    await expect(
      controller.respondToSignOff(undefined, '11111111-1111-4111-8111-111111111111', {
        action: 'approve',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid respond ids', async () => {
    const controller = new SignOffsController({
      requestResolution: vi.fn(),
    } as never);

    await expect(
      controller.respondToSignOff(
        {
          workspace: { id: '22222222-2222-4222-8222-222222222222' },
          membership: { userId: '44444444-4444-4444-8444-444444444444' },
        } as never,
        'not-a-uuid',
        { action: 'approve' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid respond payloads', async () => {
    const controller = new SignOffsController({
      requestResolution: vi.fn(),
    } as never);

    await expect(
      controller.respondToSignOff(
        {
          workspace: { id: '22222222-2222-4222-8222-222222222222' },
          membership: { userId: '44444444-4444-4444-8444-444444444444' },
        } as never,
        '11111111-1111-4111-8111-111111111111',
        { action: 'reject' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes workspace and actor ids when responding to a sign-off', async () => {
    const service = {
      requestResolution: vi.fn().mockResolvedValue({ pendingDecision: {}, signOff: {} }),
    };
    const controller = new SignOffsController(service as never);

    await controller.respondToSignOff(
      {
        workspace: { id: '22222222-2222-4222-8222-222222222222' },
        membership: { userId: '44444444-4444-4444-8444-444444444444' },
      } as never,
      '11111111-1111-4111-8111-111111111111',
      { action: 'approve' },
    );

    expect(service.requestResolution).toHaveBeenCalledWith({
      workspaceId: '22222222-2222-4222-8222-222222222222',
      signOffId: '11111111-1111-4111-8111-111111111111',
      actorUserId: '44444444-4444-4444-8444-444444444444',
      action: 'approve',
      reason: undefined,
    });
  });

  it('requires workspace context for reminders', async () => {
    const controller = new SignOffsController({ sendManualReminder: vi.fn() } as never);

    await expect(
      controller.sendReminder(undefined, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects invalid reminder ids', async () => {
    const controller = new SignOffsController({ sendManualReminder: vi.fn() } as never);

    await expect(
      controller.sendReminder(
        {
          workspace: { id: '22222222-2222-4222-8222-222222222222' },
          membership: { userId: '44444444-4444-4444-8444-444444444444' },
        } as never,
        'not-a-uuid',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('passes workspace and actor ids when sending reminders', async () => {
    const service = {
      sendManualReminder: vi.fn().mockResolvedValue({ signOff: {} }),
    };
    const controller = new SignOffsController(service as never);

    await controller.sendReminder(
      {
        workspace: { id: '22222222-2222-4222-8222-222222222222' },
        membership: { userId: '44444444-4444-4444-8444-444444444444' },
      } as never,
      '11111111-1111-4111-8111-111111111111',
    );

    expect(service.sendManualReminder).toHaveBeenCalledWith({
      workspaceId: '22222222-2222-4222-8222-222222222222',
      signOffId: '11111111-1111-4111-8111-111111111111',
      actorUserId: '44444444-4444-4444-8444-444444444444',
    });
  });
});
