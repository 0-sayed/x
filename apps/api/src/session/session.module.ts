import { Module } from '@nestjs/common';
import { getSessionRuntimeConfig } from '@materiabill/config';

import { InframodernOAuthClient } from './inframodern-oauth.client.js';
import { SessionController } from './session.controller.js';
import { SessionCrypto } from './session.crypto.js';
import { SessionGuard } from './session.guard.js';
import { NestSessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [SessionController],
  providers: [
    NestSessionRepository,
    {
      provide: SessionCrypto,
      useFactory: () => new SessionCrypto(getSessionRuntimeConfig(process.env).encryptionKey),
    },
    {
      provide: InframodernOAuthClient,
      useFactory: () => new InframodernOAuthClient(getSessionRuntimeConfig(process.env)),
    },
    {
      provide: SessionService,
      useFactory: (
        repository: NestSessionRepository,
        oauthClient: InframodernOAuthClient,
        crypto: SessionCrypto,
      ) =>
        new SessionService(repository, oauthClient, crypto, {
          sessionTtlSeconds: getSessionRuntimeConfig(process.env).sessionTtlSeconds,
        }),
      inject: [NestSessionRepository, InframodernOAuthClient, SessionCrypto],
    },
    {
      provide: SessionGuard,
      useFactory: (sessionService: SessionService) => new SessionGuard(sessionService),
      inject: [SessionService],
    },
  ],
  exports: [SessionService, SessionGuard],
})
export class SessionModule {}
