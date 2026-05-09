import { Effect, Option, type DateTime } from "effect";

import type { WorkflowRunId } from "../../ids";
import {
  InvalidClaimOwner,
  NoActiveClaim,
  WorkflowRunNotActive
} from "../errors";
import {
  AttentionItemOpened,
  ClaimReleased,
  WorkflowRunFailed
} from "../facts";
import type { NewAttentionItem, TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type FailWorkflowRunIntent = Readonly<{
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
  attentionItems: readonly [NewAttentionItem, ...Array<NewAttentionItem>];
}>;

export const failWorkflowRun = (
  state: TaskLifecycleState,
  intent: FailWorkflowRunIntent
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
        status: "failed",
        updatedAt: intent.updatedAt
      }),
      activeClaim: Option.none(),
      activeWorkflowRun: Option.none(),
      pendingAttentionItems: [
        ...state.pendingAttentionItems,
        ...intent.attentionItems
      ]
    },
    facts: [
      new WorkflowRunFailed({
        taskId: state.taskId,
        workflowRunId: activeWorkflowRun.id,
        workflowId: activeWorkflowRun.workflowId
      }),
      new ClaimReleased({
        taskId: state.taskId,
        claimId: activeClaim.id,
        outcome: "failed"
      }),
      ...intent.attentionItems.map(
        (attentionItem) =>
          new AttentionItemOpened({
            taskId: state.taskId,
            kind: attentionItem.kind
          })
      )
    ]
  });
};
