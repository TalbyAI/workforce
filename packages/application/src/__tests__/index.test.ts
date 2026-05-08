import { DateTime, Duration, Effect, Layer, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ClaimMarkerFailed,
  ClaimMarkerPort,
  EligibilityRuleViolated,
  IdGenerator,
  MemoryRecordPort,
  RepositoryConflict,
  RepositoryUnavailable,
  TaskLifecycleRepository,
  TrackerProjectionPort,
  TrackerProjectionFailed,
  claimTaskForWorkflow,
  failWorkflowRun,
  openAttentionItem,
  releaseClaim,
  startWorkflowRun,
  WallClockLive
} from "../index";
import {
  AttentionItemId,
  ClaimId,
  ConversationId,
  type DomainFact,
  type NewAttentionItem,
  Stage,
  TaskId,
  TaskAlreadyClaimed,
  type TaskLifecycleState,
  TaskNotEligibleForClaim,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
  WallClock,
  makeLease
} from "@talby/workforce-domain";

const decodeTaskId = (value: string): TaskId =>
  Schema.decodeUnknownSync(TaskId)(value);

const decodeWorkspaceId = (value: string): WorkspaceId =>
  Schema.decodeUnknownSync(WorkspaceId)(value);

const decodeConversationId = (value: string): ConversationId =>
  Schema.decodeUnknownSync(ConversationId)(value);

const decodeClaimId = (value: string): ClaimId =>
  Schema.decodeUnknownSync(ClaimId)(value);

const decodeWorkflowId = (value: string): WorkflowId =>
  Schema.decodeUnknownSync(WorkflowId)(value);

const decodeWorkflowRunId = (value: string): WorkflowRunId =>
  Schema.decodeUnknownSync(WorkflowRunId)(value);

const decodeAttentionItemId = (value: string): AttentionItemId =>
  Schema.decodeUnknownSync(AttentionItemId)(value);

const decodeStage = (value: string): Stage =>
  Schema.decodeUnknownSync(Stage)(value);

const decodeUtc = (value: string): DateTime.Utc =>
  Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(value);

const makeClaim = () => ({
  id: decodeClaimId("claim-1"),
  workflowId: decodeWorkflowId("workflow-1"),
  lease: makeLease({
    createdAt: decodeUtc("2026-05-08T10:00:00.000Z"),
    leaseDuration: Duration.minutes(30),
    renewalWindow: Duration.minutes(5)
  })
});

const baseState = (
  overrides: Partial<TaskLifecycleState> = {}
): TaskLifecycleState => ({
  taskId: decodeTaskId("task-1"),
  workspaceId: decodeWorkspaceId("workspace-1"),
  stage: decodeStage("triage"),
  executionState: Option.none(),
  activeClaim: Option.none(),
  activeWorkflowRun: Option.none(),
  attentionItems: [],
  conversationId: decodeConversationId("conversation-1"),
  sourceReference: {
    trackerId: "tracker-1",
    recordId: "record-1"
  },
  repositoryTargets: [],
  pendingActiveClaim: Option.none(),
  pendingActiveWorkflowRun: Option.none(),
  pendingAttentionItems: [],
  ...overrides
});

type PortCall =
  | "load"
  | "save"
  | "tracker"
  | "claim-marker"
  | "memory"
  | `id:${string}`;

const makeHarness = (args: {
  state: TaskLifecycleState;
  generatedIds?: ReadonlyArray<string>;
  trackerEffect?: Effect.Effect<void, TrackerProjectionFailed>;
  claimMarkerEffect?: Effect.Effect<void, ClaimMarkerFailed>;
}) => {
  const calls: Array<PortCall> = [];
  const savedFacts: Array<ReadonlyArray<DomainFact>> = [];
  const trackerFacts: Array<ReadonlyArray<DomainFact>> = [];
  const claimMarkerFacts: Array<ReadonlyArray<DomainFact>> = [];
  const memoryFacts: Array<ReadonlyArray<DomainFact>> = [];
  const savedStates: Array<TaskLifecycleState> = [];
  const generatedIds = [...(args.generatedIds ?? [])];

  const layer = Layer.mergeAll(
    Layer.succeed(TaskLifecycleRepository, {
      load: () => {
        calls.push("load");
        return Effect.succeed(Option.some(args.state));
      },
      save: (state: TaskLifecycleState, facts: ReadonlyArray<DomainFact>) => {
        calls.push("save");
        savedStates.push(state);
        savedFacts.push(facts);
        return Effect.void;
      }
    }),
    Layer.succeed(IdGenerator, {
      generate: <Id extends string>(kind: string) => {
        calls.push(`id:${kind}`);
        const nextId = generatedIds.shift() ?? `${kind}-generated`;
        return Effect.succeed(nextId as Id);
      }
    }),
    Layer.succeed(TrackerProjectionPort, {
      project: (
        _state: TaskLifecycleState,
        facts: ReadonlyArray<DomainFact>
      ) => {
        calls.push("tracker");
        trackerFacts.push(facts);
        return args.trackerEffect ?? Effect.void;
      }
    }),
    Layer.succeed(ClaimMarkerPort, {
      project: (
        _state: TaskLifecycleState,
        facts: ReadonlyArray<DomainFact>
      ) => {
        calls.push("claim-marker");
        claimMarkerFacts.push(facts);
        return args.claimMarkerEffect ?? Effect.void;
      }
    }),
    Layer.succeed(MemoryRecordPort, {
      record: (_state: TaskLifecycleState, facts: ReadonlyArray<DomainFact>) => {
        calls.push("memory");
        memoryFacts.push(facts);
        return Effect.void;
      }
    })
  );

  return {
    calls,
    savedFacts,
    trackerFacts,
    claimMarkerFacts,
    memoryFacts,
    savedStates,
    layer
  };
};

describe("application package foundation", () => {
  it("exports tagged application errors", () => {
    expect(new RepositoryUnavailable()._tag).toBe("RepositoryUnavailable");
    expect(new RepositoryConflict()._tag).toBe("RepositoryConflict");
    expect(new TrackerProjectionFailed()._tag).toBe("TrackerProjectionFailed");
    expect(new ClaimMarkerFailed()._tag).toBe("ClaimMarkerFailed");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });

  it("exposes service tags for Phase 5 application ports", async () => {
    const taskId = decodeTaskId("task-1");
    const serviceCalls: Array<string> = [];
    const repositoryLayer = Layer.succeed(TaskLifecycleRepository, {
      load: (requestedTaskId: TaskId) => {
        serviceCalls.push(`load:${requestedTaskId}`);
        return Effect.succeed(Option.none<TaskLifecycleState>());
      },
      save: () => {
        serviceCalls.push("save");
        return Effect.void;
      }
    });
    const idGeneratorLayer = Layer.succeed(IdGenerator, {
      generate: <Id extends string>(kind: string) => {
        serviceCalls.push(`id:${kind}`);
        return Effect.succeed(`${kind}-1` as Id);
      }
    });
    const trackerLayer = Layer.succeed(TrackerProjectionPort, {
      project: () => {
        serviceCalls.push("tracker");
        return Effect.void;
      }
    });
    const claimMarkerLayer = Layer.succeed(ClaimMarkerPort, {
      project: () => {
        serviceCalls.push("claim-marker");
        return Effect.void;
      }
    });
    const memoryLayer = Layer.succeed(MemoryRecordPort, {
      record: () => {
        serviceCalls.push("memory");
        return Effect.void;
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TaskLifecycleRepository;
        const idGenerator = yield* IdGenerator;
        const trackerProjection = yield* TrackerProjectionPort;
        const claimMarker = yield* ClaimMarkerPort;
        const memoryRecord = yield* MemoryRecordPort;

        yield* repository.load(taskId);
        yield* idGenerator.generate("claim");
        yield* trackerProjection.project({} as TaskLifecycleState, []);
        yield* claimMarker.project({} as TaskLifecycleState, []);
        yield* memoryRecord.record({} as TaskLifecycleState, []);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            repositoryLayer,
            idGeneratorLayer,
            trackerLayer,
            claimMarkerLayer,
            memoryLayer
          )
        )
      )
    );

    expect(serviceCalls).toEqual([
      "load:task-1",
      "id:claim",
      "tracker",
      "claim-marker",
      "memory"
    ]);
  });

  it("provides a WallClock layer backed by Effect Clock", async () => {
    const before = Date.now();

    const now = await Effect.runPromise(
      Effect.gen(function* () {
        const wallClock = yield* WallClock;
        return yield* wallClock.now;
      }).pipe(Effect.provide(WallClockLive))
    );

    const after = Date.now();

    expect(DateTime.toEpochMillis(now)).toBeGreaterThanOrEqual(before);
    expect(DateTime.toEpochMillis(now)).toBeLessThanOrEqual(after);
  });

  it("keeps domain and application errors distinct in the combined layer surface", () => {
    expect(new TaskNotEligibleForClaim()._tag).toBe("TaskNotEligibleForClaim");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });

  it("claims a task by loading, enriching ids, saving, then projecting", async () => {
    const harness = makeHarness({
      state: baseState(),
      generatedIds: ["claim-1"]
    });

    const result = await Effect.runPromise(
      claimTaskForWorkflow({
        taskId: decodeTaskId("task-1"),
        workflowId: decodeWorkflowId("workflow-1"),
        isEligible: true,
        leaseDuration: Duration.minutes(30),
        renewalWindow: Duration.minutes(5)
      }).pipe(
        Effect.provide(harness.layer),
        Effect.provideService(WallClock, {
          now: Effect.succeed(decodeUtc("2026-05-08T10:00:00.000Z"))
        })
      )
    );

    expect(harness.calls).toEqual([
      "load",
      "id:claim",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(Option.isSome(result.state.activeClaim)).toBe(true);
    if (Option.isNone(result.state.activeClaim)) {
      throw new Error("expected active claim");
    }

    expect(result.state.activeClaim.value.id).toBe("claim-1");
    expect(Option.isNone(result.state.pendingActiveClaim)).toBe(true);
    expect(harness.savedFacts[0]?.map((fact) => fact._tag)).toEqual([
      "ClaimAcquired"
    ]);
    expect(harness.trackerFacts[0]?.map((fact) => fact._tag)).toEqual([
      "ClaimAcquired"
    ]);
  });

  it("releases a claim by saving and projecting the resulting fact", async () => {
    const activeClaim = makeClaim();
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(activeClaim)
      })
    });

    const result = await Effect.runPromise(
      releaseClaim({
        taskId: decodeTaskId("task-1"),
        claimId: activeClaim.id,
        outcome: "abandoned"
      }).pipe(Effect.provide(harness.layer))
    );

    expect(harness.calls).toEqual([
      "load",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(Option.isNone(result.state.activeClaim)).toBe(true);
    expect(harness.savedFacts[0]?.map((fact) => fact._tag)).toEqual([
      "ClaimReleased"
    ]);
    expect(harness.memoryFacts[0]?.map((fact) => fact._tag)).toEqual([
      "ClaimReleased"
    ]);
  });

  it("drains pending workflow run and attention item ids before persistence", async () => {
    const activeClaim = makeClaim();
    const runningState = baseState({
      activeClaim: Option.some(activeClaim)
    });

    const startHarness = makeHarness({
      state: runningState,
      generatedIds: ["run-1"]
    });
    const started = await Effect.runPromise(
      startWorkflowRun({
        taskId: runningState.taskId,
        claimId: activeClaim.id,
        startedAt: decodeUtc("2026-05-08T10:05:00.000Z")
      }).pipe(Effect.provide(startHarness.layer))
    );

    expect(startHarness.calls).toEqual([
      "load",
      "id:workflow-run",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(Option.isSome(started.state.activeWorkflowRun)).toBe(true);
    if (Option.isNone(started.state.activeWorkflowRun)) {
      throw new Error("expected workflow run");
    }

    expect(started.state.activeWorkflowRun.value.id).toBe("run-1");

    const attentionHarness = makeHarness({
      state: runningState,
      generatedIds: ["attention-1"]
    });
    const opened = await Effect.runPromise(
      openAttentionItem({
        taskId: runningState.taskId,
        kind: "manual_review_required",
        openedAt: decodeUtc("2026-05-08T10:10:00.000Z")
      }).pipe(Effect.provide(attentionHarness.layer))
    );

    expect(attentionHarness.calls).toEqual([
      "load",
      "id:attention-item",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(opened.state.attentionItems).toEqual([
      {
        id: decodeAttentionItemId("attention-1"),
        kind: "manual_review_required",
        openedAt: decodeUtc("2026-05-08T10:10:00.000Z"),
        status: "open"
      }
    ]);
  });

  it("does not save or project when the domain rejects a transition", async () => {
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(makeClaim())
      })
    });

    const result = await Effect.runPromise(
      Effect.result(
        claimTaskForWorkflow({
          taskId: decodeTaskId("task-1"),
          workflowId: decodeWorkflowId("workflow-2"),
          isEligible: true,
          leaseDuration: Duration.minutes(30),
          renewalWindow: Duration.minutes(5)
        }).pipe(
          Effect.provide(harness.layer),
          Effect.provideService(WallClock, {
            now: Effect.succeed(decodeUtc("2026-05-08T10:00:00.000Z"))
          })
        )
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected domain failure");
    }

    expect(result.failure).toBeInstanceOf(TaskAlreadyClaimed);
    expect(harness.calls).toEqual(["load"]);
  });

  it("surfaces projection failures distinctly after persistence succeeds", async () => {
    const activeClaim = makeClaim();
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T10:12:00.000Z"),
      status: "open"
    };
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(activeClaim),
        activeWorkflowRun: Option.some({
          id: decodeWorkflowRunId("run-1"),
          workflowId: activeClaim.workflowId,
          claimId: activeClaim.id
        })
      }),
      generatedIds: ["attention-1"],
      trackerEffect: Effect.fail(new TrackerProjectionFailed())
    });

    const result = await Effect.runPromise(
      Effect.result(
        failWorkflowRun({
          taskId: decodeTaskId("task-1"),
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T10:15:00.000Z"),
          attentionItems: [attentionItem]
        }).pipe(Effect.provide(harness.layer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected projection failure");
    }

    expect(result.failure).toBeInstanceOf(TrackerProjectionFailed);
    expect(harness.calls).toEqual([
      "load",
      "id:attention-item",
      "save",
      "tracker"
    ]);
  });
});
