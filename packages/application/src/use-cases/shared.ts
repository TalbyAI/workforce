import { Effect, Option } from "effect";

import type {
  AttentionItem,
  DomainFact,
  DomainTransitionSuccess,
  TaskId,
  TaskLifecycleState
} from "@talby/workforce-domain";

import {
  ClaimMarkerPort,
  IdGenerator,
  MemoryRecordPort,
  TaskLifecycleRepository,
  TrackerProjectionPort
} from "../ports";
import {
  ClaimMarkerFailed,
  MemoryRecordWriteFailed,
  RepositoryConflict,
  RepositoryUnavailable,
  TrackerProjectionFailed
} from "../errors";

export type UseCaseResult = Readonly<{
  state: TaskLifecycleState;
  facts: ReadonlyArray<DomainFact>;
}>;

type EnrichPendingState<R> = (
  state: TaskLifecycleState
) => Effect.Effect<TaskLifecycleState, never, R>;

const loadState = (
  taskId: TaskId
): Effect.Effect<
  TaskLifecycleState,
  RepositoryUnavailable,
  TaskLifecycleRepository
> =>
  Effect.gen(function* () {
    const repository = yield* TaskLifecycleRepository;
    const maybeState = yield* repository.load(taskId);

    if (Option.isNone(maybeState)) {
      return yield* Effect.fail(new RepositoryUnavailable());
    }

    return maybeState.value;
  });

const drainPendingClaim = (
  state: TaskLifecycleState
): Effect.Effect<TaskLifecycleState, never, IdGenerator> =>
  Effect.gen(function* () {
    if (Option.isNone(state.pendingActiveClaim)) {
      return state;
    }

    const idGenerator = yield* IdGenerator;
    const claimId = yield* idGenerator.generate("claim");

    return {
      ...state,
      activeClaim: Option.some({
        id: claimId,
        ...state.pendingActiveClaim.value
      }),
      pendingActiveClaim: Option.none()
    };
  });

const drainPendingWorkflowRun = (
  state: TaskLifecycleState
): Effect.Effect<TaskLifecycleState, never, IdGenerator> =>
  Effect.gen(function* () {
    if (Option.isNone(state.pendingActiveWorkflowRun)) {
      return state;
    }

    const idGenerator = yield* IdGenerator;
    const workflowRunId = yield* idGenerator.generate("workflow-run");

    return {
      ...state,
      activeWorkflowRun: Option.some({
        id: workflowRunId,
        ...state.pendingActiveWorkflowRun.value
      }),
      pendingActiveWorkflowRun: Option.none()
    };
  });

const drainPendingAttentionItems = (
  state: TaskLifecycleState
): Effect.Effect<TaskLifecycleState, never, IdGenerator> =>
  Effect.gen(function* () {
    if (state.pendingAttentionItems.length === 0) {
      return state;
    }

    const idGenerator = yield* IdGenerator;
    const generatedAttentionItems = yield* Effect.forEach(
      state.pendingAttentionItems,
      (attentionItem) =>
        Effect.map(
          idGenerator.generate("attention-item"),
          (attentionItemId): AttentionItem => ({
            id: attentionItemId,
            ...attentionItem
          })
        )
    );

    return {
      ...state,
      attentionItems: [...state.attentionItems, ...generatedAttentionItems],
      pendingAttentionItems: []
    };
  });

export const enrichPendingState = (
  state: TaskLifecycleState
): Effect.Effect<TaskLifecycleState, never, IdGenerator> =>
  Effect.gen(function* () {
    const withClaim = yield* drainPendingClaim(state);
    const withWorkflowRun = yield* drainPendingWorkflowRun(withClaim);
    return yield* drainPendingAttentionItems(withWorkflowRun);
  });

export const runTransitionUseCase = <
  TransitionE,
  TransitionR,
  EnrichR = never
>(args: {
  taskId: TaskId;
  transition: (
    state: TaskLifecycleState
  ) => Effect.Effect<DomainTransitionSuccess, TransitionE, TransitionR>;
  enrich?: EnrichPendingState<EnrichR>;
}): Effect.Effect<
  UseCaseResult,
  | TransitionE
  | RepositoryUnavailable
  | RepositoryConflict
  | TrackerProjectionFailed
  | ClaimMarkerFailed
  | MemoryRecordWriteFailed,
  | TaskLifecycleRepository
  | TrackerProjectionPort
  | ClaimMarkerPort
  | MemoryRecordPort
  | TransitionR
  | EnrichR
> =>
  Effect.gen(function* () {
    const currentState = yield* loadState(args.taskId);
    const transitionResult = yield* args.transition(currentState);
    const state = args.enrich
      ? yield* args.enrich(transitionResult.nextState)
      : transitionResult.nextState;

    const repository = yield* TaskLifecycleRepository;
    const trackerProjection = yield* TrackerProjectionPort;
    const claimMarker = yield* ClaimMarkerPort;
    const memoryRecord = yield* MemoryRecordPort;

    yield* repository.save(state, transitionResult.facts);
    yield* trackerProjection.project(state, transitionResult.facts);
    yield* claimMarker.project(state, transitionResult.facts);
    yield* memoryRecord.record(state, transitionResult.facts);

    return {
      state,
      facts: transitionResult.facts
    };
  });
