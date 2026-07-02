import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ClientIdentitiesService } from './client-identities.service.js';

function makeClientIdentityRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Client One',
    email: 'client@example.com',
    phoneE164: null,
    verifiedEmailAt: new Date('2026-07-02T00:00:00.000Z'),
    verifiedPhoneAt: null,
    inframodernUserId: null,
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

function createRepositoryMock() {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByPhone: vi.fn(),
    createIdentity: vi.fn(),
  };
}

describe('ClientIdentitiesService', () => {
  it('normalizes email before lookup', async () => {
    const repository = createRepositoryMock();
    repository.findByEmail.mockResolvedValue(undefined);
    repository.findByPhone.mockResolvedValue(undefined);
    const service = new ClientIdentitiesService(repository as never);

    await service.findByVerifiedContact({ email: ' CLIENT@Example.COM ' });

    expect(repository.findByEmail).toHaveBeenCalledWith('client@example.com');
  });

  it('returns existing identity before creating a duplicate', async () => {
    const existing = makeClientIdentityRecord();
    const repository = createRepositoryMock();
    repository.findByEmail.mockResolvedValue(existing);
    const service = new ClientIdentitiesService(repository as never);

    await expect(
      service.findOrCreateByVerifiedContact({
        displayName: 'Client One',
        email: 'client@example.com',
        verifiedEmailAt: '2026-07-02T00:00:00.000Z',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: existing.id }));
    expect(repository.createIdentity).not.toHaveBeenCalled();
  });

  it('creates an identity when no verified contact exists', async () => {
    const created = makeClientIdentityRecord({
      email: null,
      phoneE164: '+966555123456',
      verifiedEmailAt: null,
      verifiedPhoneAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    const repository = createRepositoryMock();
    repository.findByEmail.mockResolvedValue(undefined);
    repository.findByPhone.mockResolvedValue(undefined);
    repository.createIdentity.mockResolvedValue(created);
    const service = new ClientIdentitiesService(repository as never);

    await expect(
      service.findOrCreateByVerifiedContact({
        displayName: 'Client One',
        phoneE164: '+966555123456',
        verifiedPhoneAt: '2026-07-02T00:00:00.000Z',
      }),
    ).resolves.toEqual(expect.objectContaining({ phoneE164: '+966555123456' }));
  });

  it('rejects identity creation without verified contact data', async () => {
    const repository = createRepositoryMock();
    const service = new ClientIdentitiesService(repository as never);

    await expect(service.createIdentity({ displayName: 'Client One' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.createIdentity).not.toHaveBeenCalled();
  });

  it('reports whether an identity exists', async () => {
    const repository = createRepositoryMock();
    repository.findById.mockResolvedValue(makeClientIdentityRecord());
    const service = new ClientIdentitiesService(repository as never);

    await expect(service.identityExists('11111111-1111-4111-8111-111111111111')).resolves.toBe(
      true,
    );
  });
});
