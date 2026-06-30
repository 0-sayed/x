import { describe, expect, it } from 'vitest';

import { SessionCrypto } from './session.crypto.js';

describe('SessionCrypto', () => {
  const encryptionKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

  it('encrypts and decrypts OAuth tokens with AES-256-GCM', () => {
    const crypto = new SessionCrypto(encryptionKey);
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      scope: 'openid profile email',
    };

    const encrypted = crypto.encrypt(tokens);

    expect(encrypted).not.toContain(tokens.accessToken);
    expect(crypto.decrypt(encrypted)).toEqual(tokens);
  });

  it('rejects keys that do not decode to 32 bytes', () => {
    expect(() => new SessionCrypto(Buffer.from('too-short').toString('base64'))).toThrow(
      'SESSION_ENCRYPTION_KEY must decode to 32 bytes',
    );
  });

  it('fails to decrypt with the wrong key', () => {
    const crypto = new SessionCrypto(encryptionKey);
    const wrongCrypto = new SessionCrypto(
      Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64'),
    );
    const encrypted = crypto.encrypt({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer',
      scope: null,
    });

    expect(() => wrongCrypto.decrypt(encrypted)).toThrow('Unable to decrypt session tokens');
  });
});
