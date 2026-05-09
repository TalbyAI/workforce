import { Effect, Option, type Duration } from "effect";

import { WallClock } from "../../services/wall-clock";
import { TaskAlreadyClaimed } from "../errors";
import { ClaimAcquired } from "../facts";
import { type NewClaim, type TaskLifecycleState } from "../state";
import { makeLease } from "../../values";
import type { WorkflowId } from "../../ids";
import { checkClaimEligibility } from "./check-claim-eligibility";
import type { DomainTransition } from "./shared";

export type ClaimTaskIntent = Readonly<{
  workflowId: WorkflowId;
  leaseDuration: Duration.Duration;
  renewalWindow: Duration.Duration;
}>;

export const claimTask = (
  state: TaskLifecycleState,
  intent: ClaimTaskIntent
): DomainTransition<WallClock> =>
  Effect.gen(function* () {
    yield* checkClaimEligibility(state);

    if (Option.isSome(state.pendingActiveClaim)) {
      return yield* Effect.fail(new TaskAlreadyClaimed());
    }

    const wallClock = yield* WallClock;
    const now = yield* wallClock.now;
    const lease = makeLease({
      createdAt: now,
      leaseDuration: intent.leaseDuration,
      renewalWindow: intent.renewalWindow
    });
    const pendingClaim: NewClaim = {
      workflowId: intent.workflowId,
      lease
    };

    return {
      nextState: {
        ...state,
        pendingActiveClaim: Option.some(pendingClaim)
      },
      facts: [
        new ClaimAcquired({
          taskId: state.taskId,
          workflowId: intent.workflowId,
          lease
        })
      ]
    };
  });
