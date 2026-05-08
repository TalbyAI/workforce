import { Effect, Option } from "effect";

import type { ClaimId } from "../../ids";
import type { ClaimOutcome } from "../../values";
import {
  ClaimOutcomeNotAllowed,
  InvalidClaimOwner,
  NoActiveClaim
} from "../errors";
import { ClaimReleased } from "../facts";
import type { TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

const releasableClaimOutcomes: ReadonlySet<ClaimOutcome> = new Set([
  "abandoned",
  "expired",
  "revoked"
]);

export type ReleaseClaimIntent = Readonly<{
  claimId: ClaimId;
  outcome: ClaimOutcome;
}>;

export const releaseClaim = (
  state: TaskLifecycleState,
  intent: ReleaseClaimIntent
): DomainTransition => {
  if (Option.isNone(state.activeClaim)) {
    return Effect.fail(new NoActiveClaim());
  }

  const activeClaim = state.activeClaim.value;

  if (activeClaim.id !== intent.claimId) {
    return Effect.fail(new NoActiveClaim());
  }

  if (Option.isSome(state.activeWorkflowRun)) {
    return Effect.fail(new InvalidClaimOwner());
  }

  if (!releasableClaimOutcomes.has(intent.outcome)) {
    return Effect.fail(
      new ClaimOutcomeNotAllowed({
        outcome: intent.outcome
      })
    );
  }

  return Effect.succeed({
    nextState: {
      ...state,
      activeClaim: Option.none()
    },
    facts: [
      new ClaimReleased({
        taskId: state.taskId,
        claimId: activeClaim.id,
        outcome: intent.outcome
      })
    ]
  });
};
