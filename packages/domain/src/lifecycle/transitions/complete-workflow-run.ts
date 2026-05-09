import { Effect, Option, type DateTime } from "effect";

import type { WorkflowRunId } from "../../ids";
import type { WorkflowRunOutcome } from "../../values";
import {
  InvalidClaimOwner,
  NoActiveClaim,
  WorkflowRunNotActive
} from "../errors";
import { ClaimReleased, WorkflowRunCompleted } from "../facts";
import type { TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type CompleteWorkflowRunOutcome = Exclude<
  WorkflowRunOutcome,
  "failed" | "handed_off"
>;

export type CompleteWorkflowRunIntent = Readonly<{
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
  outcome: CompleteWorkflowRunOutcome;
}>;

export const completeWorkflowRun = (
  state: TaskLifecycleState,
  intent: CompleteWorkflowRunIntent
): DomainTransition => {
  if (Option.isNone(state.activeWorkflowRun)) {
    return Effect.fail(new WorkflowRunNotActive());
  }

  if (Option.isNone(state.activeClaim)) {
    return Effect.fail(new NoActiveClaim());
  }

  const activeWorkflowRun = state.activeWorkflowRun.value;
  const activeClaim = state.activeClaim.value;

  if (activeWorkflowRun.id !== intent.workflowRunId) {
    return Effect.fail(new WorkflowRunNotActive());
  }

  if (activeWorkflowRun.claimId !== activeClaim.id) {
    return Effect.fail(new InvalidClaimOwner());
  }

  return Effect.succeed({
    nextState: {
      ...state,
      executionState: Option.some({
        status: intent.outcome === "canceled" ? "canceled" : "completed",
        updatedAt: intent.updatedAt
      }),
      activeClaim: Option.none(),
      activeWorkflowRun: Option.none()
    },
    facts: [
      new WorkflowRunCompleted({
        taskId: state.taskId,
        workflowRunId: activeWorkflowRun.id,
        workflowId: activeWorkflowRun.workflowId,
        outcome: intent.outcome
      }),
      new ClaimReleased({
        taskId: state.taskId,
        claimId: activeClaim.id,
        outcome: intent.outcome === "canceled" ? "revoked" : "completed"
      })
    ]
  });
};
