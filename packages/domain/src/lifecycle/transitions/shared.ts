import type { Effect } from "effect";

import type { DomainError } from "../errors";
import type { DomainFact } from "../facts";
import type { TaskLifecycleState } from "../state";

export type DomainTransitionSuccess = Readonly<{
  nextState: TaskLifecycleState;
  facts: ReadonlyArray<DomainFact>;
}>;

export type DomainTransition<R = never> = Effect.Effect<
  DomainTransitionSuccess,
  DomainError,
  R
>;
