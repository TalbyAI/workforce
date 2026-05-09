import { Context, Effect } from "effect";

import type { DomainFact, TaskLifecycleState } from "@talby/workforce-domain";
import type { ClaimMarkerFailed } from "../errors";

export interface ClaimMarkerPortService {
  readonly project: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void, ClaimMarkerFailed>;
}

export class ClaimMarkerPort extends Context.Service<
  ClaimMarkerPort,
  ClaimMarkerPortService
>()("@talby/workforce-application/ClaimMarkerPort") {}
