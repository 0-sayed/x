import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { StoredOAuthTokens } from './session.types.js';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function decodeKey(encryptionKey: string): Buffer {
  const decodedKey = Buffer.from(encryptionKey, 'base64');

  if (decodedKey.length !== 32) {
    throw new Error('SESSION_ENCRYPTION_KEY must decode to 32 bytes');
  }

  return decodedKey;
}

function assertStoredOAuthTokens(value: unknown): StoredOAuthTokens {
  if (!value || typeof value !== 'object') {
    throw new Error('Unable to decrypt session tokens');
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.accessToken !== 'string' ||
    typeof candidate.refreshToken !== 'string' ||
    typeof candidate.tokenType !== 'string' ||
    (candidate.scope !== null && typeof candidate.scope !== 'string')
  ) {
    throw new Error('Unable to decrypt session tokens');
  }

  return {
    accessToken: candidate.accessToken,
    refreshToken: candidate.refreshToken,
    tokenType: candidate.tokenType,
    scope: candidate.scope,
  };
}

export class SessionCrypto {
  readonly #key: Buffer;

  constructor(encryptionKey: string) {
    this.#key = decodeKey(encryptionKey);
  }

  encrypt(tokens: StoredOAuthTokens): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.#key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(tokens), 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(payload: string): StoredOAuthTokens {
    try {
      const [ivPart, authTagPart, encryptedPart] = payload.split('.');

      if (!ivPart || !authTagPart || !encryptedPart) {
        throw new Error('Unable to decrypt session tokens');
      }

      const iv = Buffer.from(ivPart, 'base64url');
      const authTag = Buffer.from(authTagPart, 'base64url');
      const encrypted = Buffer.from(encryptedPart, 'base64url');
      const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, this.#key, iv);

      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        'utf8',
      );

      return assertStoredOAuthTokens(JSON.parse(decrypted));
    } catch {
      throw new Error('Unable to decrypt session tokens');
    }
  }
}
