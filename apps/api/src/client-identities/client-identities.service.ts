import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
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

    let recordByEmail: ClientIdentityRecord | undefined;
    let recordByPhone: ClientIdentityRecord | undefined;

    if (parsed.email) {
      recordByEmail = await this.clientIdentitiesRepository.findByEmail(parsed.email);
    }

    if (parsed.phoneE164) {
      recordByPhone = await this.clientIdentitiesRepository.findByPhone(parsed.phoneE164);
    }

    if (recordByEmail && recordByPhone && recordByEmail.id !== recordByPhone.id) {
      throw new BadRequestException(
        'The provided email and phone number belong to different client identities',
      );
    }

    const record = recordByEmail ?? recordByPhone;
    if (record) {
      return this.toClientIdentity(record);
    }

    return undefined;
  }

  async createIdentity(input: CreateClientIdentityInput): Promise<ClientIdentity> {
    const parsed = parseRequest(
      createClientIdentityRequestSchema,
      input,
      'Invalid client identity',
    );
    try {
      const record = await this.clientIdentitiesRepository.createIdentity(parsed);
      return this.toClientIdentity(record);
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new ConflictException(
          'A client identity with this email or phone number already exists',
        );
      }
      throw error;
    }
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

    try {
      return await this.createIdentity(parsed);
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        throw error;
      }

      const createdConcurrently = await this.findByVerifiedContact({
        email: parsed.email,
        phoneE164: parsed.phoneE164,
      });
      if (createdConcurrently) {
        return createdConcurrently;
      }

      throw error;
    }
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

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
