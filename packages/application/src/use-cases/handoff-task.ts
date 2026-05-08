import type { DateTime, Effect } from "effect";

import {
  type DomainError,
  type TaskId,
  type WorkflowRunId,
  handoffTask as handoffTaskTransition
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

export type HandoffTaskIntent = Readonly<{
  taskId: TaskId;
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
}>;

export const handoffTask = (
  intent: HandoffTaskIntent
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
      handoffTaskTransition(state, {
        workflowRunId: intent.workflowRunId,
        updatedAt: intent.updatedAt
      })
  });
