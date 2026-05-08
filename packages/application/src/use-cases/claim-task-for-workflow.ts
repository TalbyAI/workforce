import { Duration, Effect } from "effect";

import {
  type DomainError,
  type TaskId,
  type WorkflowId,
  type WallClock,
  claimTask,
  checkClaimEligibility
} from "@talby/workforce-domain";

import type {
  ApplicationError,
  ClaimMarkerFailed,
  MemoryRecordWriteFailed,
  RepositoryConflict,
  RepositoryUnavailable,
  TrackerProjectionFailed
} from "../errors";
import { EligibilityRuleViolated } from "../errors";
import type {
  ClaimMarkerPort,
  IdGenerator,
  MemoryRecordPort,
  TaskLifecycleRepository,
  TrackerProjectionPort
} from "../ports";
import {
  enrichPendingState,
  runTransitionUseCase,
  type UseCaseResult
} from "./shared";

export type ClaimTaskForWorkflowIntent = Readonly<{
  taskId: TaskId;
  workflowId: WorkflowId;
  isEligible: boolean;
  leaseDuration: Duration.Duration;
  renewalWindow: Duration.Duration;
}>;

export const claimTaskForWorkflow = (
  intent: ClaimTaskForWorkflowIntent
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
  | WallClock
> => {
  if (!intent.isEligible) {
    return new EligibilityRuleViolated().pipe(Effect.fail);
  }

  return runTransitionUseCase({
    taskId: intent.taskId,
    transition: (state) =>
      Effect.flatMap(checkClaimEligibility(state), () =>
        claimTask(state, {
          workflowId: intent.workflowId,
          leaseDuration: intent.leaseDuration,
          renewalWindow: intent.renewalWindow
        })
      ),
    enrich: enrichPendingState
  });
};
