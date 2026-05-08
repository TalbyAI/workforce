import type { DateTime, Effect } from "effect";

import {
  type ClaimId,
  type DomainError,
  type TaskId,
  startWorkflowRun as startWorkflowRunTransition
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
  IdGenerator,
  MemoryRecordPort,
  TaskLifecycleRepository,
  TrackerProjectionPort
} from "../ports";
import { enrichPendingState, runTransitionUseCase, type UseCaseResult } from "./shared";

export type StartWorkflowRunIntent = Readonly<{
  taskId: TaskId;
  claimId: ClaimId;
  startedAt: DateTime.Utc;
}>;

export const startWorkflowRun = (
  intent: StartWorkflowRunIntent
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
  | IdGenerator
  | TrackerProjectionPort
  | ClaimMarkerPort
  | MemoryRecordPort
> =>
  runTransitionUseCase({
    taskId: intent.taskId,
    transition: (state) =>
      startWorkflowRunTransition(state, {
        claimId: intent.claimId,
        startedAt: intent.startedAt
      }),
    enrich: enrichPendingState
  });
