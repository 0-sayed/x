import { Inject, Injectable } from '@nestjs/common';
import { clientIdentities, type ClientIdentityRecord, type DatabaseClient } from '@materiabill/db';
import { eq, sql } from 'drizzle-orm';

import { DATABASE_CLIENT } from '../database/database.module.js';
import type { CreateClientIdentityInput } from './client-identities.types.js';

type Db = DatabaseClient['db'];

@Injectable()
export class ClientIdentitiesRepository {
  readonly #db: Db;

  constructor(@Inject(DATABASE_CLIENT) databaseClient: DatabaseClient) {
    this.#db = databaseClient.db;
  }

  async findById(id: string): Promise<ClientIdentityRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(clientIdentities)
      .where(eq(clientIdentities.id, id))
      .limit(1);

    return rows[0];
  }

  async findByEmail(email: string): Promise<ClientIdentityRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(clientIdentities)
      .where(sql`lower(${clientIdentities.email}) = ${email.toLowerCase()}`)
      .limit(1);

    return rows[0];
  }

  async findByPhone(phoneE164: string): Promise<ClientIdentityRecord | undefined> {
    const rows = await this.#db
      .select()
      .from(clientIdentities)
      .where(eq(clientIdentities.phoneE164, phoneE164))
      .limit(1);

    return rows[0];
  }

  async createIdentity(input: CreateClientIdentityInput): Promise<ClientIdentityRecord> {
    const rows = await this.#db
      .insert(clientIdentities)
      .values({
        displayName: input.displayName,
        email: input.email ?? null,
        phoneE164: input.phoneE164 ?? null,
        verifiedEmailAt: input.verifiedEmailAt ? new Date(input.verifiedEmailAt) : null,
        verifiedPhoneAt: input.verifiedPhoneAt ? new Date(input.verifiedPhoneAt) : null,
        inframodernUserId: input.inframodernUserId ?? null,
      })
      .returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Failed to insert client identity');
    }

    return row;
  }
}
