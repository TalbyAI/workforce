import type { Effect } from "effect";

import {
  type ClaimId,
  type ClaimOutcome,
  type DomainError,
  type TaskId,
  releaseClaim as releaseClaimTransition
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

export type ReleaseClaimIntent = Readonly<{
  taskId: TaskId;
  claimId: ClaimId;
  outcome: ClaimOutcome;
}>;

export const releaseClaim = (
  intent: ReleaseClaimIntent
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
      releaseClaimTransition(state, {
        claimId: intent.claimId,
        outcome: intent.outcome
      })
  });
