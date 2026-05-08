import type { Duration, Effect } from "effect";

import {
  type ClaimId,
  type DomainError,
  type TaskId,
  type WallClock,
  renewLease
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

export type RenewClaimLeaseIntent = Readonly<{
  taskId: TaskId;
  claimId: ClaimId;
  leaseDuration: Duration.Duration;
  renewalWindow: Duration.Duration;
}>;

export const renewClaimLease = (
  intent: RenewClaimLeaseIntent
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
  | WallClock
> =>
  runTransitionUseCase({
    taskId: intent.taskId,
    transition: (state) =>
      renewLease(state, {
        claimId: intent.claimId,
        leaseDuration: intent.leaseDuration,
        renewalWindow: intent.renewalWindow
      })
  });
