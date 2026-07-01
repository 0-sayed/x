import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  clientIdentityContactSchema,
  clientIdentitySchema,
  createClientIdentityRequestSchema,
  type ClientIdentity,
} from '@materiabill/contracts';
import type { ClientIdentityRecord } from '@materiabill/db';

import { ClientIdentitiesRepository } from './client-identities.repository.js';
import type {
  ClientIdentityContactInput,
  CreateClientIdentityInput,
} from './client-identities.types.js';

@Injectable()
export class ClientIdentitiesService {
  constructor(
    @Inject(ClientIdentitiesRepository)
    private readonly clientIdentitiesRepository: ClientIdentitiesRepository,
  ) {}

  async identityExists(id: string): Promise<boolean> {
    return Boolean(await this.clientIdentitiesRepository.findById(id));
  }

  async findByVerifiedContact(
    contact: ClientIdentityContactInput,
  ): Promise<ClientIdentity | undefined> {
    const parsed = parseRequest(clientIdentityContactSchema, contact, 'Invalid client contact');

    if (parsed.email) {
      const record = await this.clientIdentitiesRepository.findByEmail(parsed.email);
      if (record) {
        return this.toClientIdentity(record);
      }
    }

    if (parsed.phoneE164) {
      const record = await this.clientIdentitiesRepository.findByPhone(parsed.phoneE164);
      if (record) {
        return this.toClientIdentity(record);
      }
    }

    return undefined;
  }

  async createIdentity(input: CreateClientIdentityInput): Promise<ClientIdentity> {
    const parsed = parseRequest(
      createClientIdentityRequestSchema,
      input,
      'Invalid client identity',
    );
    const record = await this.clientIdentitiesRepository.createIdentity(parsed);
    return this.toClientIdentity(record);
  }

  async findOrCreateByVerifiedContact(input: CreateClientIdentityInput): Promise<ClientIdentity> {
    const parsed = parseRequest(
      createClientIdentityRequestSchema,
      input,
      'Invalid client identity',
    );
    const existing = await this.findByVerifiedContact({
      email: parsed.email,
      phoneE164: parsed.phoneE164,
    });

    if (existing) {
      return existing;
    }

    return this.createIdentity(parsed);
  }

  private toClientIdentity(record: ClientIdentityRecord): ClientIdentity {
    return clientIdentitySchema.parse({
      id: record.id,
      displayName: record.displayName,
      email: record.email,
      phoneE164: record.phoneE164,
      verifiedEmailAt: record.verifiedEmailAt?.toISOString() ?? null,
      verifiedPhoneAt: record.verifiedPhoneAt?.toISOString() ?? null,
      inframodernUserId: record.inframodernUserId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }
}

type RequestSchema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false };
};

function parseRequest<T>(schema: RequestSchema<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(message);
  }
  return parsed.data;
}
