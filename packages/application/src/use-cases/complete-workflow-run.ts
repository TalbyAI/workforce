import type { DateTime, Effect } from "effect";

import {
  type DomainError,
  type TaskId,
  type WorkflowRunId,
  type WorkflowRunOutcome,
  completeWorkflowRun as completeWorkflowRunTransition
} from "@talby/workforce-domain";

import type {
  ApplicationError,
  ClaimMarkerFailed,
  MemoryRecordWriteFailed,
  RepositoryConflict,
  RepositoryUnavailable,
  TrackerProjectionFailed
} from "../errors";
import type {
  ClaimMarkerPort,
  MemoryRecordPort,
  TaskLifecycleRepository,
  TrackerProjectionPort
} from "../ports";
import { runTransitionUseCase, type UseCaseResult } from "./shared";

export type CompleteWorkflowRunIntent = Readonly<{
  taskId: TaskId;
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
  outcome: Exclude<WorkflowRunOutcome, "failed" | "handed_off">;
}>;

export const completeWorkflowRun = (
  intent: CompleteWorkflowRunIntent
): Effect.Effect<
  UseCaseResult,
  | DomainError
  | ApplicationError
  | RepositoryUnavailable
  | RepositoryConflict
  | TrackerProjectionFailed
  | ClaimMarkerFailed
  | MemoryRecordWriteFailed,
  | TaskLifecycleRepository
  | TrackerProjectionPort
  | ClaimMarkerPort
  | MemoryRecordPort
> =>
  runTransitionUseCase({
    taskId: intent.taskId,
    transition: (state) =>
      completeWorkflowRunTransition(state, {
        workflowRunId: intent.workflowRunId,
        updatedAt: intent.updatedAt,
        outcome: intent.outcome
      })
  });
