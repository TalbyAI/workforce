import { Context, Effect } from "effect";

import type { DomainFact, TaskLifecycleState } from "@talby/workforce-domain";

export interface ClaimMarkerPortService {
  readonly project: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void>;
}

export class ClaimMarkerPort extends Context.Service<
  ClaimMarkerPort,
  ClaimMarkerPortService
>()("@talby/workforce-application/ClaimMarkerPort") {}
