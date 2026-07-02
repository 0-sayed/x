import { Injectable } from '@nestjs/common';
import type { SignOffRecord } from '@materiabill/db';

export type SignOffResolutionContext = {
  readonly actorUserId: string;
  readonly decisionId: string;
  readonly resolvedAt: Date;
};

export type SignOffResolutionHandler = {
  readonly subjectType: string;
  readonly handle: (
    signOff: SignOffRecord,
    context: SignOffResolutionContext,
  ) => Promise<void> | void;
};

@Injectable()
export class SignOffResolutionHandlerRegistry {
  readonly #handlers = new Map<string, SignOffResolutionHandler['handle'][]>();

  register(handler: SignOffResolutionHandler): void {
    const handlers = this.#handlers.get(handler.subjectType) ?? [];
    handlers.push(handler.handle);
    this.#handlers.set(handler.subjectType, handlers);
  }

  async handle(signOff: SignOffRecord, context: SignOffResolutionContext): Promise<void> {
    const handlers = this.#handlers.get(signOff.subjectType) ?? [];
    for (const handler of handlers) {
      await handler(signOff, context);
    }
  }
}
