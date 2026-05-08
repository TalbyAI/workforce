import { Effect, Option } from "effect";

import { TaskAlreadyClaimed, TaskNotEligibleForClaim } from "../errors";
import { isTerminalExecutionState, type TaskLifecycleState } from "../state";

export const checkClaimEligibility = (
  state: TaskLifecycleState
): Effect.Effect<void, TaskAlreadyClaimed | TaskNotEligibleForClaim> => {
  if (Option.isSome(state.activeClaim)) {
    return Effect.fail(new TaskAlreadyClaimed());
  }

  if (
    Option.isSome(state.executionState) &&
    isTerminalExecutionState(state.executionState.value)
  ) {
    return Effect.fail(new TaskNotEligibleForClaim());
  }

  return Effect.void;
};
