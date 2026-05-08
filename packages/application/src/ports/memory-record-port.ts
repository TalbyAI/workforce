import { Context, Effect } from "effect";

import type { DomainFact, TaskLifecycleState } from "@talby/workforce-domain";

export interface MemoryRecordPortService {
  readonly record: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void>;
}

export class MemoryRecordPort extends Context.Service<
  MemoryRecordPort,
  MemoryRecordPortService
>()("@talby/workforce-application/MemoryRecordPort") {}
