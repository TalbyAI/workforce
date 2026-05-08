import { Context, Effect } from "effect";

import type { DomainFact, TaskLifecycleState } from "@talby/workforce-domain";
import type { TrackerProjectionFailed } from "../errors";

export interface TrackerProjectionPortService {
  readonly project: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void, TrackerProjectionFailed>;
}

export class TrackerProjectionPort extends Context.Service<
  TrackerProjectionPort,
  TrackerProjectionPortService
>()("@talby/workforce-application/TrackerProjectionPort") {}
