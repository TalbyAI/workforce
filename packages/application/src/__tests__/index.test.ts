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
  completeWorkflowRun,
  failWorkflowRun,
  handoffTask,
  openAttentionItem,
  releaseClaim,
  renewClaimLease,
  resolveAttentionItem,
  startWorkflowRun,
  WallClockLive
} from "../index";
import type { IdByKind } from "../index";
import {
  AttentionItemId,
  AttentionItemNotOpen,
  ClaimId,
  ConversationId,
  type DomainFact,
  InvalidHandoff,
  LeaseExpired,
  type NewAttentionItem,
  Stage,
  TaskId,
  TaskAlreadyClaimed,
  type TaskLifecycleState,
  TaskNotEligibleForClaim,
  WorkflowId,
  WorkflowRunId,
  WorkflowRunNotActive,
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
      generate: <K extends keyof IdByKind>(kind: K) => {
        calls.push(`id:${kind}`);
        const nextId = generatedIds.shift() ?? `${kind}-generated`;
        return Effect.succeed(nextId as IdByKind[K]);
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
      record: (
        _state: TaskLifecycleState,
        facts: ReadonlyArray<DomainFact>
      ) => {
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
  // Scenario: Given the application error types are constructed
  // When their tags are inspected
  // Then each error exposes its expected tagged identity
  it("exports tagged application errors", () => {
    expect(new RepositoryUnavailable()._tag).toBe("RepositoryUnavailable");
    expect(new RepositoryConflict()._tag).toBe("RepositoryConflict");
    expect(new TrackerProjectionFailed()._tag).toBe("TrackerProjectionFailed");
    expect(new ClaimMarkerFailed()._tag).toBe("ClaimMarkerFailed");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });

  // Scenario: Given the application service tags are provided
  // When each service is resolved and invoked once
  // Then the expected port operations are observable through the harness
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
      generate: <K extends keyof IdByKind>(kind: K) => {
        serviceCalls.push(`id:${kind}`);
        return Effect.succeed(`${kind}-1` as IdByKind[K]);
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

  // Scenario: Given the WallClock live layer is available
  // When the current time is requested through the service
  // Then the returned instant falls within the real clock bounds
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

  // Scenario: Given domain and application errors share a composed layer surface
  // When each error tag is inspected
  // Then their identities remain distinct across the boundary
  it("keeps domain and application errors distinct in the combined layer surface", () => {
    expect(new TaskNotEligibleForClaim()._tag).toBe("TaskNotEligibleForClaim");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });

  // Scenario: Given an eligible task can be claimed through the application layer
  // When the claim workflow runs with generated ids and a wall clock
  // Then the state is saved, projected, and returned with an active claim
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

  // Scenario: Given a task has an active claim in persistence
  // When the application releases that claim
  // Then the resulting state and emitted facts are saved and projected
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

  // Scenario: Given pending workflow and attention identifiers must be materialized
  // When workflow start and attention opening run through the application layer
  // Then generated ids are drained into persisted active state records
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

  // Scenario: Given the domain rejects a requested transition
  // When the application tries to claim an already-claimed task
  // Then no persistence or projection side effects occur
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

  // Scenario: Given a task has an active claim and an active workflow run
  // When completeWorkflowRun is called with a matching workflow run id
  // Then WorkflowRunCompleted and ClaimReleased facts are saved and projected
  it("completes a workflow run saving WorkflowRunCompleted and ClaimReleased facts", async () => {
    const activeClaim = makeClaim();
    const workflowRunId = decodeWorkflowRunId("run-1");
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(activeClaim),
        activeWorkflowRun: Option.some({
          id: workflowRunId,
          workflowId: activeClaim.workflowId,
          claimId: activeClaim.id
        })
      })
    });

    const result = await Effect.runPromise(
      completeWorkflowRun({
        taskId: decodeTaskId("task-1"),
        workflowRunId,
        updatedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
        outcome: "completed"
      }).pipe(Effect.provide(harness.layer))
    );

    expect(harness.calls).toEqual([
      "load",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(harness.savedFacts[0]?.map((f) => f._tag)).toEqual([
      "WorkflowRunCompleted",
      "ClaimReleased"
    ]);
    expect(Option.isNone(result.state.activeClaim)).toBe(true);
    expect(Option.isNone(result.state.activeWorkflowRun)).toBe(true);
  });

  // Scenario: Given a task has no active workflow run
  // When completeWorkflowRun is called
  // Then the domain rejects with WorkflowRunNotActive and no side effects occur
  it("does not save when no active workflow run exists on complete", async () => {
    const harness = makeHarness({ state: baseState() });

    const result = await Effect.runPromise(
      Effect.result(
        completeWorkflowRun({
          taskId: decodeTaskId("task-1"),
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
          outcome: "completed"
        }).pipe(Effect.provide(harness.layer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
    expect(harness.calls).toEqual(["load"]);
  });

  // Scenario: Given a task has an active claim and an active workflow run
  // When failWorkflowRun is called with a matching workflow run id and an attention item
  // Then WorkflowRunFailed, ClaimReleased, and AttentionItemOpened facts are saved and projected
  it("fails a workflow run saving WorkflowRunFailed, ClaimReleased, and AttentionItemOpened facts", async () => {
    const activeClaim = makeClaim();
    const workflowRunId = decodeWorkflowRunId("run-1");
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
      status: "open"
    };
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(activeClaim),
        activeWorkflowRun: Option.some({
          id: workflowRunId,
          workflowId: activeClaim.workflowId,
          claimId: activeClaim.id
        })
      }),
      generatedIds: ["attention-1"]
    });

    const result = await Effect.runPromise(
      failWorkflowRun({
        taskId: decodeTaskId("task-1"),
        workflowRunId,
        updatedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
        attentionItems: [attentionItem]
      }).pipe(Effect.provide(harness.layer))
    );

    expect(harness.calls).toEqual([
      "load",
      "id:attention-item",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(harness.savedFacts[0]?.map((f) => f._tag)).toEqual([
      "WorkflowRunFailed",
      "ClaimReleased",
      "AttentionItemOpened"
    ]);
    expect(Option.isNone(result.state.activeClaim)).toBe(true);
    expect(Option.isNone(result.state.activeWorkflowRun)).toBe(true);
    expect(result.state.attentionItems).toHaveLength(1);
    expect(result.state.attentionItems[0]?.id).toBe("attention-1");
  });

  // Scenario: Given a task has no active workflow run
  // When failWorkflowRun is called
  // Then the domain rejects with WorkflowRunNotActive and no side effects occur
  it("does not save when no active workflow run exists on fail", async () => {
    const harness = makeHarness({ state: baseState() });
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
      status: "open"
    };

    const result = await Effect.runPromise(
      Effect.result(
        failWorkflowRun({
          taskId: decodeTaskId("task-1"),
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T11:00:00.000Z"),
          attentionItems: [attentionItem]
        }).pipe(Effect.provide(harness.layer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
    expect(harness.calls).toEqual(["load"]);
  });

  // Scenario: Given a task has an active claim and an active workflow run
  // When handoffTask is called with a matching workflow run id
  // Then ClaimReleased and TaskHandedOff facts are saved and projected
  it("hands off a task saving ClaimReleased and TaskHandedOff facts", async () => {
    const activeClaim = makeClaim();
    const workflowRunId = decodeWorkflowRunId("run-1");
    const harness = makeHarness({
      state: baseState({
        activeClaim: Option.some(activeClaim),
        activeWorkflowRun: Option.some({
          id: workflowRunId,
          workflowId: activeClaim.workflowId,
          claimId: activeClaim.id
        })
      })
    });

    const result = await Effect.runPromise(
      handoffTask({
        taskId: decodeTaskId("task-1"),
        workflowRunId,
        updatedAt: decodeUtc("2026-05-08T11:00:00.000Z")
      }).pipe(Effect.provide(harness.layer))
    );

    expect(harness.calls).toEqual([
      "load",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(harness.savedFacts[0]?.map((f) => f._tag)).toEqual([
      "ClaimReleased",
      "TaskHandedOff"
    ]);
    expect(Option.isNone(result.state.activeClaim)).toBe(true);
    expect(Option.isNone(result.state.activeWorkflowRun)).toBe(true);
  });

  // Scenario: Given a task has no active claim or workflow run
  // When handoffTask is called
  // Then the domain rejects with InvalidHandoff and no side effects occur
  it("fails with InvalidHandoff when no active claim or workflow run", async () => {
    const harness = makeHarness({ state: baseState() });

    const result = await Effect.runPromise(
      Effect.result(
        handoffTask({
          taskId: decodeTaskId("task-1"),
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T11:00:00.000Z")
        }).pipe(Effect.provide(harness.layer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(InvalidHandoff);
    expect(harness.calls).toEqual(["load"]);
  });

  // Scenario: Given a task has an active claim whose lease has not yet expired
  // When renewClaimLease is called before the expiry time
  // Then a LeaseRenewed fact is saved and the claim lease is updated
  it("renews a non-expired claim lease and saves LeaseRenewed", async () => {
    const activeClaim = makeClaim(); // created at 10:00, expires at 10:30
    const harness = makeHarness({
      state: baseState({ activeClaim: Option.some(activeClaim) })
    });

    const result = await Effect.runPromise(
      renewClaimLease({
        taskId: decodeTaskId("task-1"),
        claimId: activeClaim.id,
        leaseDuration: Duration.minutes(30),
        renewalWindow: Duration.minutes(5)
      }).pipe(
        Effect.provide(harness.layer),
        Effect.provideService(WallClock, {
          now: Effect.succeed(decodeUtc("2026-05-08T10:15:00.000Z"))
        })
      )
    );

    expect(harness.calls).toEqual([
      "load",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(harness.savedFacts[0]?.map((f) => f._tag)).toEqual(["LeaseRenewed"]);
    expect(Option.isSome(result.state.activeClaim)).toBe(true);
  });

  // Scenario: Given a task has an active claim whose lease has already expired
  // When renewClaimLease is called after the expiry time
  // Then the domain rejects with LeaseExpired and no side effects occur
  it("fails with LeaseExpired when the claim lease has passed its expiry", async () => {
    const activeClaim = makeClaim(); // created at 10:00, expires at 10:30
    const harness = makeHarness({
      state: baseState({ activeClaim: Option.some(activeClaim) })
    });

    const result = await Effect.runPromise(
      Effect.result(
        renewClaimLease({
          taskId: decodeTaskId("task-1"),
          claimId: activeClaim.id,
          leaseDuration: Duration.minutes(30),
          renewalWindow: Duration.minutes(5)
        }).pipe(
          Effect.provide(harness.layer),
          Effect.provideService(WallClock, {
            now: Effect.succeed(decodeUtc("2026-05-08T10:31:00.000Z"))
          })
        )
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(LeaseExpired);
    expect(harness.calls).toEqual(["load"]);
  });

  // Scenario: Given a task has an open attention item in its persisted state
  // When resolveAttentionItem is called with its id
  // Then an AttentionItemResolved fact is saved and the item status becomes resolved
  it("resolves an open attention item and saves AttentionItemResolved", async () => {
    const attentionItemId = decodeAttentionItemId("attention-1");
    const harness = makeHarness({
      state: baseState({
        attentionItems: [
          {
            id: attentionItemId,
            kind: "manual_review_required",
            openedAt: decodeUtc("2026-05-08T10:10:00.000Z"),
            status: "open"
          }
        ]
      })
    });

    const result = await Effect.runPromise(
      resolveAttentionItem({
        taskId: decodeTaskId("task-1"),
        attentionItemId
      }).pipe(Effect.provide(harness.layer))
    );

    expect(harness.calls).toEqual([
      "load",
      "save",
      "tracker",
      "claim-marker",
      "memory"
    ]);
    expect(harness.savedFacts[0]?.map((f) => f._tag)).toEqual([
      "AttentionItemResolved"
    ]);
    expect(result.state.attentionItems[0]?.status).toBe("resolved");
  });

  // Scenario: Given a task has no open attention item matching the given id
  // When resolveAttentionItem is called with an absent id
  // Then the domain rejects with AttentionItemNotOpen and no side effects occur
  it("fails with AttentionItemNotOpen when no matching open attention item exists", async () => {
    const harness = makeHarness({ state: baseState() });

    const result = await Effect.runPromise(
      Effect.result(
        resolveAttentionItem({
          taskId: decodeTaskId("task-1"),
          attentionItemId: decodeAttentionItemId("attention-missing")
        }).pipe(Effect.provide(harness.layer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(AttentionItemNotOpen);
    expect(harness.calls).toEqual(["load"]);
  });

  // Scenario: Given a workflow is not eligible for claiming
  // When claimTaskForWorkflow is called with isEligible false
  // Then EligibilityRuleViolated is raised immediately without touching any port
  it("fails immediately with EligibilityRuleViolated before loading when isEligible is false", async () => {
    const harness = makeHarness({ state: baseState() });

    const result = await Effect.runPromise(
      Effect.result(
        claimTaskForWorkflow({
          taskId: decodeTaskId("task-1"),
          workflowId: decodeWorkflowId("workflow-1"),
          isEligible: false,
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
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(EligibilityRuleViolated);
    expect(harness.calls).toEqual([]);
  });

  // Scenario: Given the repository holds no record for the requested task id
  // When any use case attempts to load that task
  // Then RepositoryUnavailable is surfaced and no further side effects occur
  it("surfaces RepositoryUnavailable when the task is absent in the repository", async () => {
    const calls: Array<string> = [];
    const emptyRepoLayer = Layer.mergeAll(
      Layer.succeed(TaskLifecycleRepository, {
        load: (_taskId: TaskId) => {
          calls.push("load");
          return Effect.succeed(Option.none<TaskLifecycleState>());
        },
        save: (_state: TaskLifecycleState, _facts: ReadonlyArray<DomainFact>) =>
          Effect.void
      }),
      Layer.succeed(IdGenerator, {
        generate: <K extends keyof IdByKind>(kind: K) =>
          Effect.succeed(`${kind}-1` as IdByKind[K])
      }),
      Layer.succeed(TrackerProjectionPort, {
        project: (
          _state: TaskLifecycleState,
          _facts: ReadonlyArray<DomainFact>
        ) => Effect.void
      }),
      Layer.succeed(ClaimMarkerPort, {
        project: (
          _state: TaskLifecycleState,
          _facts: ReadonlyArray<DomainFact>
        ) => Effect.void
      }),
      Layer.succeed(MemoryRecordPort, {
        record: (
          _state: TaskLifecycleState,
          _facts: ReadonlyArray<DomainFact>
        ) => Effect.void
      })
    );

    const result = await Effect.runPromise(
      Effect.result(
        releaseClaim({
          taskId: decodeTaskId("task-missing"),
          claimId: decodeClaimId("claim-1"),
          outcome: "abandoned"
        }).pipe(Effect.provide(emptyRepoLayer))
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") throw new Error("expected failure");
    expect(result.failure).toBeInstanceOf(RepositoryUnavailable);
    expect(calls).toEqual(["load"]);
  });

  // Scenario: Given persistence succeeds but tracker projection fails
  // When a workflow failure is projected through the application layer
  // Then the application surfaces TrackerProjectionFailed after save
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
