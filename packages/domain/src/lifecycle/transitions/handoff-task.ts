import { Effect, Option, type DateTime } from "effect";

import type { WorkflowRunId } from "../../ids";
import { InvalidClaimOwner, InvalidHandoff } from "../errors";
import { ClaimReleased, TaskHandedOff } from "../facts";
import type { TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type HandoffTaskIntent = Readonly<{
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
}>;

export const handoffTask = (
  state: TaskLifecycleState,
  intent: HandoffTaskIntent
): DomainTransition => {
  if (
    Option.isNone(state.activeClaim) ||
    Option.isNone(state.activeWorkflowRun)
  ) {
    return Effect.fail(new InvalidHandoff());
  }

  const activeClaim = state.activeClaim.value;
  const activeWorkflowRun = state.activeWorkflowRun.value;

  if (activeWorkflowRun.id !== intent.workflowRunId) {
    return Effect.fail(new InvalidHandoff());
  }

  if (activeWorkflowRun.claimId !== activeClaim.id) {
    return Effect.fail(new InvalidClaimOwner());
  }

  return Effect.succeed({
    nextState: {
      ...state,
      executionState: Option.some({
        status: "handed_off",
        updatedAt: intent.updatedAt
      }),
      activeClaim: Option.none(),
      activeWorkflowRun: Option.none()
    },
    facts: [
      new ClaimReleased({
        taskId: state.taskId,
        claimId: activeClaim.id,
        outcome: "handed_off"
      }),
      new TaskHandedOff({
        taskId: state.taskId
      })
    ]
  });
};
