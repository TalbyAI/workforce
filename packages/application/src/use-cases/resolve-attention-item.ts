import type { Effect } from "effect";

import {
  type AttentionItemId,
  type DomainError,
  type TaskId,
  resolveAttentionItem as resolveAttentionItemTransition
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

export type ResolveAttentionItemIntent = Readonly<{
  taskId: TaskId;
  attentionItemId: AttentionItemId;
}>;

export const resolveAttentionItem = (
  intent: ResolveAttentionItemIntent
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
      resolveAttentionItemTransition(state, {
        attentionItemId: intent.attentionItemId
      })
  });
