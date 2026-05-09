import type { DateTime, Effect } from "effect";

import {
  type DomainError,
  type NewAttentionItem,
  type TaskId,
  type WorkflowRunId,
  failWorkflowRun as failWorkflowRunTransition
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
import {
  enrichPendingState,
  runTransitionUseCase,
  type UseCaseResult
} from "./shared";

export type FailWorkflowRunIntent = Readonly<{
  taskId: TaskId;
  workflowRunId: WorkflowRunId;
  updatedAt: DateTime.Utc;
  attentionItems: readonly [NewAttentionItem, ...Array<NewAttentionItem>];
}>;

export const failWorkflowRun = (
  intent: FailWorkflowRunIntent
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
      failWorkflowRunTransition(state, {
        workflowRunId: intent.workflowRunId,
        updatedAt: intent.updatedAt,
        attentionItems: intent.attentionItems
      }),
    enrich: enrichPendingState
  });
