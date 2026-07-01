import { Injectable } from '@nestjs/common';
import type { PendingDecisionRecord } from '@materiabill/db';

export type GraceWindowCommitHandler = {
  readonly decisionType: string;
  readonly commit: (decision: PendingDecisionRecord, now: Date) => Promise<void>;
};

@Injectable()
export class GraceWindowCommitHandlerRegistry {
  readonly #handlers = new Map<string, GraceWindowCommitHandler>();

  register(handler: GraceWindowCommitHandler): void {
    this.#handlers.set(handler.decisionType, handler);
  }

  async commit(decision: PendingDecisionRecord, now: Date): Promise<void> {
    const handler = this.#handlers.get(decision.decisionType);
    if (!handler) {
      throw new Error(
        `No grace-window commit handler registered for decision type: ${decision.decisionType}`,
      );
    }

    await handler.commit(decision, now);
  }
}
