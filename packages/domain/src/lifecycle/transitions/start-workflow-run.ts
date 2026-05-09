import { Effect, Option, type DateTime } from "effect";

import type { ClaimId } from "../../ids";
import {
  InvalidClaimOwner,
  NoActiveClaim,
  WorkflowRunAlreadyActive
} from "../errors";
import { WorkflowRunStarted } from "../facts";
import type { TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type StartWorkflowRunIntent = Readonly<{
  claimId: ClaimId;
  startedAt: DateTime.Utc;
}>;

export const startWorkflowRun = (
  state: TaskLifecycleState,
  intent: StartWorkflowRunIntent
): DomainTransition => {
  if (Option.isNone(state.activeClaim)) {
    return Effect.fail(new NoActiveClaim());
  }

  if (Option.isSome(state.activeWorkflowRun)) {
    return Effect.fail(new WorkflowRunAlreadyActive());
  }

  const activeClaim = state.activeClaim.value;

  if (activeClaim.id !== intent.claimId) {
    return Effect.fail(new InvalidClaimOwner());
  }

  return Effect.succeed({
    nextState: {
      ...state,
      executionState: Option.some({
        status: "running",
        updatedAt: intent.startedAt
      }),
      pendingActiveWorkflowRun: Option.some({
        workflowId: activeClaim.workflowId,
        claimId: activeClaim.id
      })
    },
    facts: [
      new WorkflowRunStarted({
        taskId: state.taskId,
        workflowId: activeClaim.workflowId,
        claimId: activeClaim.id
      })
    ]
  });
};
