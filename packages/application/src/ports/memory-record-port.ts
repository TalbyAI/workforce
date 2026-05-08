import { Context, Effect } from "effect";

import type { DomainFact, TaskLifecycleState } from "@talby/workforce-domain";
import type { MemoryRecordWriteFailed } from "../errors";

export interface MemoryRecordPortService {
  readonly record: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void, MemoryRecordWriteFailed>;
}

export class MemoryRecordPort extends Context.Service<
  MemoryRecordPort,
  MemoryRecordPortService
>()("@talby/workforce-application/MemoryRecordPort") {}
