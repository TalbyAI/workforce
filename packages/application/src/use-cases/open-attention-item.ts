import type { DateTime, Effect } from "effect";

import {
  type AttentionItemKind,
  type DomainError,
  type TaskId,
  openAttentionItem as openAttentionItemTransition
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

export type OpenAttentionItemIntent = Readonly<{
  taskId: TaskId;
  kind: AttentionItemKind;
  openedAt: DateTime.Utc;
}>;

export const openAttentionItem = (
  intent: OpenAttentionItemIntent
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
      openAttentionItemTransition(state, {
        kind: intent.kind,
        openedAt: intent.openedAt
      }),
    enrich: enrichPendingState
  });
