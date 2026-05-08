import { DateTime, Duration, Effect, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AttentionItemId,
  AttentionItemNotOpen,
  type AttentionItemStatus,
  type Claim,
  ClaimId,
  ClaimAcquired,
  ClaimOutcomeNotAllowed,
  ConversationId,
  type ExecutionState,
  InvalidClaimOwner,
  InvalidHandoff,
  LeaseExpired,
  type NewAttentionItem,
  NoActiveClaim,
  Stage,
  TaskId,
  TaskAlreadyClaimed,
  TaskNotEligibleForClaim,
  type TaskLifecycleState,
  WorkflowId,
  WorkflowRunAlreadyActive,
  WorkflowRunId,
  WorkflowRunNotActive,
  WallClock,
  WorkspaceId,
  claimTask,
  completeWorkflowRun,
  failWorkflowRun,
  handoffTask,
  makeLease,
  openAttentionItem,
  releaseClaim,
  renewLease,
  resolveAttentionItem,
  startWorkflowRun
} from "../index";

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

const decodeStage = (value: string): Stage =>
  Schema.decodeUnknownSync(Stage)(value);

const decodeUtc = (value: string): DateTime.Utc =>
  Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(value);

const makeExecutionState = (
  status: ExecutionState["status"],
  updatedAt = decodeUtc("2026-05-08T10:00:00.000Z")
): ExecutionState => ({
  status,
  updatedAt
});

const makeClaim = (
  overrides: Partial<Claim> = {},
  createdAt = decodeUtc("2026-05-08T10:00:00.000Z")
): Claim => ({
  id: decodeClaimId("claim-1"),
  workflowId: decodeWorkflowId("workflow-1"),
  lease: makeLease({
    createdAt,
    leaseDuration: Duration.minutes(30),
    renewalWindow: Duration.minutes(5)
  }),
  ...overrides
});

const makeAttentionItem = (
  status: AttentionItemStatus,
  openedAt = decodeUtc("2026-05-08T10:00:00.000Z")
) => ({
  id: Schema.decodeUnknownSync(AttentionItemId)("attention-1"),
  kind: "manual_review_required" as const,
  openedAt,
  status
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

const provideWallClock = <A, E>(
  effect: Effect.Effect<A, E, WallClock>,
  now: DateTime.Utc
): Effect.Effect<A, E> =>
  Effect.provideService(effect, WallClock, {
    now: Effect.succeed(now)
  });

const runEither = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(Effect.result(effect));

describe("workflow lifecycle domain transitions", () => {
  // Scenario: Given an eligible task without an active claim
  // When a workflow claims the task
  // Then the domain stages a pending claim and emits ClaimAcquired
  it("claims an eligible task", async () => {
    const now = decodeUtc("2026-05-08T10:00:00.000Z");

    const result = await Effect.runPromise(
      provideWallClock(
        claimTask(baseState(), {
          workflowId: decodeWorkflowId("workflow-1"),
          leaseDuration: Duration.minutes(30),
          renewalWindow: Duration.minutes(5)
        }),
        now
      )
    );

    expect(Option.isSome(result.nextState.pendingActiveClaim)).toBe(true);
    if (Option.isNone(result.nextState.pendingActiveClaim)) {
      throw new Error("expected a pending claim");
    }

    expect(result.nextState.pendingActiveClaim.value.workflowId).toBe(
      decodeWorkflowId("workflow-1")
    );
    expect(result.facts).toEqual([
      new ClaimAcquired({
        taskId: decodeTaskId("task-1"),
        workflowId: decodeWorkflowId("workflow-1"),
        lease: result.nextState.pendingActiveClaim.value.lease
      })
    ]);
  });

  // Scenario: Given a task that already has an active claim
  // When another workflow attempts to claim it
  // Then the domain rejects the claim with TaskAlreadyClaimed
  it("rejects claiming a task that already has an active claim", async () => {
    const result = await runEither(
      provideWallClock(
        claimTask(
          baseState({
            activeClaim: Option.some(makeClaim())
          }),
          {
            workflowId: decodeWorkflowId("workflow-2"),
            leaseDuration: Duration.minutes(30),
            renewalWindow: Duration.minutes(5)
          }
        ),
        decodeUtc("2026-05-08T10:00:00.000Z")
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected claim rejection");
    }

    expect(result.failure).toBeInstanceOf(TaskAlreadyClaimed);
  });

  // Scenario: Given a task with an active claim
  // When the lease is renewed before expiry
  // Then the domain updates the lease and emits LeaseRenewed
  it("renews an active lease before it expires", async () => {
    const activeClaim = makeClaim();
    const renewalTime = decodeUtc("2026-05-08T10:10:00.000Z");

    const result = await Effect.runPromise(
      provideWallClock(
        renewLease(
          baseState({
            activeClaim: Option.some(activeClaim)
          }),
          {
            claimId: activeClaim.id,
            leaseDuration: Duration.minutes(45),
            renewalWindow: Duration.minutes(10)
          }
        ),
        renewalTime
      )
    );

    expect(Option.isSome(result.nextState.activeClaim)).toBe(true);
    if (Option.isNone(result.nextState.activeClaim)) {
      throw new Error("expected an active claim");
    }

    expect(result.nextState.activeClaim.value.lease.createdAt).toEqual(
      renewalTime
    );
    expect(result.facts.map((fact) => fact._tag)).toEqual(["LeaseRenewed"]);
  });

  // Scenario: Given a task with an active claim
  // When release is requested with a workflow-completion-only outcome
  // Then the domain rejects the release with ClaimOutcomeNotAllowed
  it("rejects release outcomes that are reserved for workflow completion paths", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      releaseClaim(
        baseState({
          activeClaim: Option.some(activeClaim)
        }),
        {
          claimId: activeClaim.id,
          outcome: "completed"
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected release rejection");
    }

    expect(result.failure).toBeInstanceOf(ClaimOutcomeNotAllowed);
  });

  // Scenario: Given a task with an active claim
  // When release is requested with a non-workflow ending outcome
  // Then the domain clears the claim and emits ClaimReleased
  it("allows release outcomes used for non-workflow claim endings", async () => {
    const activeClaim = makeClaim();

    const result = await Effect.runPromise(
      releaseClaim(
        baseState({
          activeClaim: Option.some(activeClaim)
        }),
        {
          claimId: activeClaim.id,
          outcome: "abandoned"
        }
      )
    );

    expect(Option.isNone(result.nextState.activeClaim)).toBe(true);
    expect(result.facts.map((fact) => fact._tag)).toEqual(["ClaimReleased"]);
  });

  // Scenario: Given a task that already has an active workflow run
  // When the same task tries to start another workflow run
  // Then the domain rejects the request with WorkflowRunAlreadyActive
  it("prevents starting a second active workflow run for the same task", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      startWorkflowRun(
        baseState({
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          claimId: activeClaim.id,
          startedAt: decodeUtc("2026-05-08T10:05:00.000Z")
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected workflow run rejection");
    }

    expect(result.failure).toBeInstanceOf(WorkflowRunAlreadyActive);
  });

  // Scenario: Given a running workflow with an active claim
  // When the workflow run fails and opens attention
  // Then the domain clears the claim, closes the run, and stages attention items
  it("fails a workflow run by releasing the claim and opening attention", async () => {
    const activeClaim = makeClaim();
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T10:15:00.000Z"),
      status: "open"
    };

    const result = await Effect.runPromise(
      failWorkflowRun(
        baseState({
          executionState: Option.some(makeExecutionState("running")),
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T10:20:00.000Z"),
          attentionItems: [attentionItem]
        }
      )
    );

    expect(Option.isNone(result.nextState.activeClaim)).toBe(true);
    expect(Option.isNone(result.nextState.activeWorkflowRun)).toBe(true);
    expect(result.nextState.pendingAttentionItems).toEqual([attentionItem]);
    expect(result.facts.map((fact) => fact._tag)).toEqual([
      "WorkflowRunFailed",
      "ClaimReleased",
      "AttentionItemOpened"
    ]);
  });

  // Scenario: Given a task without an active claim
  // When a handoff is attempted
  // Then the domain rejects the handoff with InvalidHandoff
  it("rejects handoff when there is no active claim to release", async () => {
    const result = await runEither(
      handoffTask(baseState(), {
        workflowRunId: decodeWorkflowRunId("run-1"),
        updatedAt: decodeUtc("2026-05-08T10:30:00.000Z")
      })
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected handoff rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidHandoff);
  });

  // Scenario: Given an attention item that is already closed
  // When resolution is requested again
  // Then the domain rejects the request with AttentionItemNotOpen
  it("rejects resolving an attention item that is already closed", async () => {
    const result = await runEither(
      resolveAttentionItem(
        baseState({
          attentionItems: [makeAttentionItem("resolved")]
        }),
        {
          attentionItemId:
            Schema.decodeUnknownSync(AttentionItemId)("attention-1")
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected attention item rejection");
    }

    expect(result.failure).toBeInstanceOf(AttentionItemNotOpen);
  });

  // Scenario: Given a task in a terminal execution state
  // When a workflow attempts to claim it
  // Then the domain rejects the claim with TaskNotEligibleForClaim
  it("rejects claiming a task that is in a terminal execution state", async () => {
    const result = await runEither(
      provideWallClock(
        claimTask(
          baseState({
            executionState: Option.some(makeExecutionState("completed"))
          }),
          {
            workflowId: decodeWorkflowId("workflow-1"),
            leaseDuration: Duration.minutes(30),
            renewalWindow: Duration.minutes(5)
          }
        ),
        decodeUtc("2026-05-08T10:00:00.000Z")
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected claim rejection");
    }

    expect(result.failure).toBeInstanceOf(TaskNotEligibleForClaim);
  });

  // Scenario: Given a task without an active claim
  // When lease renewal is attempted
  // Then the domain rejects the renewal with NoActiveClaim
  it("rejects lease renewal when there is no active claim", async () => {
    const result = await runEither(
      provideWallClock(
        renewLease(baseState(), {
          claimId: decodeClaimId("claim-1"),
          leaseDuration: Duration.minutes(30),
          renewalWindow: Duration.minutes(5)
        }),
        decodeUtc("2026-05-08T10:00:00.000Z")
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected renewal rejection");
    }

    expect(result.failure).toBeInstanceOf(NoActiveClaim);
  });

  // Scenario: Given a task with an active claim
  // When lease renewal is attempted with a mismatched claim id
  // Then the domain rejects the renewal with InvalidClaimOwner
  it("rejects lease renewal when the claim id does not match the active claim", async () => {
    const result = await runEither(
      provideWallClock(
        renewLease(
          baseState({ activeClaim: Option.some(makeClaim()) }),
          {
            claimId: decodeClaimId("claim-2"),
            leaseDuration: Duration.minutes(30),
            renewalWindow: Duration.minutes(5)
          }
        ),
        decodeUtc("2026-05-08T10:00:00.000Z")
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected renewal rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidClaimOwner);
  });

  // Scenario: Given a task with an active claim whose lease has expired
  // When lease renewal is attempted
  // Then the domain rejects the renewal with LeaseExpired
  it("rejects lease renewal when the lease has already expired", async () => {
    const activeClaim = makeClaim();
    // createdAt = 10:00, leaseDuration = 30 min → expiresAt = 10:30; now is after that
    const pastExpiry = decodeUtc("2026-05-08T11:00:00.000Z");

    const result = await runEither(
      provideWallClock(
        renewLease(
          baseState({ activeClaim: Option.some(activeClaim) }),
          {
            claimId: activeClaim.id,
            leaseDuration: Duration.minutes(30),
            renewalWindow: Duration.minutes(5)
          }
        ),
        pastExpiry
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected renewal rejection");
    }

    expect(result.failure).toBeInstanceOf(LeaseExpired);
  });

  // Scenario: Given a task without an active claim
  // When release is attempted
  // Then the domain rejects the release with NoActiveClaim
  it("rejects releasing a claim when there is no active claim", async () => {
    const result = await runEither(
      releaseClaim(baseState(), {
        claimId: decodeClaimId("claim-1"),
        outcome: "abandoned"
      })
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected release rejection");
    }

    expect(result.failure).toBeInstanceOf(NoActiveClaim);
  });

  // Scenario: Given a task with an active claim and an active workflow run
  // When release is attempted outside the workflow completion path
  // Then the domain rejects the release with InvalidClaimOwner
  it("rejects releasing a claim while a workflow run is active", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      releaseClaim(
        baseState({
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          claimId: activeClaim.id,
          outcome: "abandoned"
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected release rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidClaimOwner);
  });

  // Scenario: Given a task without an active claim
  // When a workflow run start is attempted
  // Then the domain rejects the request with NoActiveClaim
  it("rejects starting a workflow run when there is no active claim", async () => {
    const result = await runEither(
      startWorkflowRun(baseState(), {
        claimId: decodeClaimId("claim-1"),
        startedAt: decodeUtc("2026-05-08T10:05:00.000Z")
      })
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected workflow run rejection");
    }

    expect(result.failure).toBeInstanceOf(NoActiveClaim);
  });

  // Scenario: Given a task with an active claim
  // When a workflow run start is attempted with a mismatched claim id
  // Then the domain rejects the request with InvalidClaimOwner
  it("rejects starting a workflow run when the claim id does not match", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      startWorkflowRun(
        baseState({ activeClaim: Option.some(activeClaim) }),
        {
          claimId: decodeClaimId("claim-2"),
          startedAt: decodeUtc("2026-05-08T10:05:00.000Z")
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected workflow run rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidClaimOwner);
  });

  // Scenario: Given a task with an active claim and no active workflow run
  // When the workflow starts a run
  // Then the domain stages a pending workflow run and emits WorkflowRunStarted
  it("starts a workflow run when the claim is valid and no run is active", async () => {
    const activeClaim = makeClaim();
    const startedAt = decodeUtc("2026-05-08T10:05:00.000Z");

    const result = await Effect.runPromise(
      startWorkflowRun(
        baseState({ activeClaim: Option.some(activeClaim) }),
        {
          claimId: activeClaim.id,
          startedAt
        }
      )
    );

    expect(Option.isSome(result.nextState.pendingActiveWorkflowRun)).toBe(true);
    expect(result.nextState.executionState).toEqual(
      Option.some({ status: "running", updatedAt: startedAt })
    );
    expect(result.facts.map((fact) => fact._tag)).toEqual(["WorkflowRunStarted"]);
  });

  // Scenario: Given a task without an active workflow run
  // When completion is attempted
  // Then the domain rejects the request with WorkflowRunNotActive
  it("rejects completing a workflow run when there is no active run", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      completeWorkflowRun(
        baseState({ activeClaim: Option.some(activeClaim) }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T10:20:00.000Z"),
          outcome: "completed"
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected completion rejection");
    }

    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
  });

  // Scenario: Given a task with an active workflow run
  // When completion is attempted with a mismatched workflow run id
  // Then the domain rejects the request with WorkflowRunNotActive
  it("rejects completing a workflow run when the run id does not match", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      completeWorkflowRun(
        baseState({
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-2"),
          updatedAt: decodeUtc("2026-05-08T10:20:00.000Z"),
          outcome: "completed"
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected completion rejection");
    }

    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
  });

  // Scenario: Given a running workflow with an active claim
  // When the workflow run completes successfully
  // Then the domain clears the claim and run and emits WorkflowRunCompleted and ClaimReleased
  it("completes a workflow run and releases the claim with a completed outcome", async () => {
    const activeClaim = makeClaim();
    const updatedAt = decodeUtc("2026-05-08T10:20:00.000Z");

    const result = await Effect.runPromise(
      completeWorkflowRun(
        baseState({
          executionState: Option.some(makeExecutionState("running")),
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt,
          outcome: "completed"
        }
      )
    );

    expect(Option.isNone(result.nextState.activeClaim)).toBe(true);
    expect(Option.isNone(result.nextState.activeWorkflowRun)).toBe(true);
    expect(result.nextState.executionState).toEqual(
      Option.some({ status: "completed", updatedAt })
    );
    expect(result.facts.map((fact) => fact._tag)).toEqual([
      "WorkflowRunCompleted",
      "ClaimReleased"
    ]);
  });

  // Scenario: Given a running workflow with an active claim
  // When the workflow run is canceled
  // Then the domain clears the claim and run and sets execution status to canceled
  it("completes a workflow run and releases the claim with a canceled outcome", async () => {
    const activeClaim = makeClaim();
    const updatedAt = decodeUtc("2026-05-08T10:20:00.000Z");

    const result = await Effect.runPromise(
      completeWorkflowRun(
        baseState({
          executionState: Option.some(makeExecutionState("running")),
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt,
          outcome: "canceled"
        }
      )
    );

    expect(Option.isNone(result.nextState.activeClaim)).toBe(true);
    expect(Option.isNone(result.nextState.activeWorkflowRun)).toBe(true);
    expect(result.nextState.executionState).toEqual(
      Option.some({ status: "canceled", updatedAt })
    );
    expect(result.facts.map((fact) => fact._tag)).toEqual([
      "WorkflowRunCompleted",
      "ClaimReleased"
    ]);
  });

  // Scenario: Given a task without an active workflow run
  // When fail is attempted
  // Then the domain rejects the request with WorkflowRunNotActive
  it("rejects failing a workflow run when there is no active run", async () => {
    const activeClaim = makeClaim();
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T10:15:00.000Z"),
      status: "open"
    };

    const result = await runEither(
      failWorkflowRun(
        baseState({ activeClaim: Option.some(activeClaim) }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T10:20:00.000Z"),
          attentionItems: [attentionItem]
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected fail rejection");
    }

    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
  });

  // Scenario: Given a task with an active workflow run
  // When fail is attempted with a mismatched workflow run id
  // Then the domain rejects the request with WorkflowRunNotActive
  it("rejects failing a workflow run when the run id does not match", async () => {
    const activeClaim = makeClaim();
    const attentionItem: NewAttentionItem = {
      kind: "workflow_run_failed",
      openedAt: decodeUtc("2026-05-08T10:15:00.000Z"),
      status: "open"
    };

    const result = await runEither(
      failWorkflowRun(
        baseState({
          executionState: Option.some(makeExecutionState("running")),
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-2"),
          updatedAt: decodeUtc("2026-05-08T10:20:00.000Z"),
          attentionItems: [attentionItem]
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected fail rejection");
    }

    expect(result.failure).toBeInstanceOf(WorkflowRunNotActive);
  });

  // Scenario: Given a task with an active claim but no active workflow run
  // When a handoff is attempted
  // Then the domain rejects the handoff with InvalidHandoff
  it("rejects handoff when there is an active claim but no workflow run", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      handoffTask(
        baseState({ activeClaim: Option.some(activeClaim) }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt: decodeUtc("2026-05-08T10:30:00.000Z")
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected handoff rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidHandoff);
  });

  // Scenario: Given a task with an active claim and a workflow run
  // When a handoff is attempted with a mismatched workflow run id
  // Then the domain rejects the handoff with InvalidHandoff
  it("rejects handoff when the workflow run id does not match", async () => {
    const activeClaim = makeClaim();

    const result = await runEither(
      handoffTask(
        baseState({
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-2"),
          updatedAt: decodeUtc("2026-05-08T10:30:00.000Z")
        }
      )
    );

    expect(result._tag).toBe("Failure");
    if (result._tag !== "Failure") {
      throw new Error("expected handoff rejection");
    }

    expect(result.failure).toBeInstanceOf(InvalidHandoff);
  });

  // Scenario: Given a task with an active claim and an active workflow run
  // When the task is handed off
  // Then the domain clears the claim and run and emits ClaimReleased and TaskHandedOff
  it("hands off a task by releasing the claim and recording the handoff", async () => {
    const activeClaim = makeClaim();
    const updatedAt = decodeUtc("2026-05-08T10:30:00.000Z");

    const result = await Effect.runPromise(
      handoffTask(
        baseState({
          executionState: Option.some(makeExecutionState("running")),
          activeClaim: Option.some(activeClaim),
          activeWorkflowRun: Option.some({
            id: decodeWorkflowRunId("run-1"),
            workflowId: activeClaim.workflowId,
            claimId: activeClaim.id
          })
        }),
        {
          workflowRunId: decodeWorkflowRunId("run-1"),
          updatedAt
        }
      )
    );

    expect(Option.isNone(result.nextState.activeClaim)).toBe(true);
    expect(Option.isNone(result.nextState.activeWorkflowRun)).toBe(true);
    expect(result.nextState.executionState).toEqual(
      Option.some({ status: "handed_off", updatedAt })
    );
    expect(result.facts.map((fact) => fact._tag)).toEqual([
      "ClaimReleased",
      "TaskHandedOff"
    ]);
  });

  // Scenario: Given a task in any state
  // When an attention item is opened
  // Then the domain stages a pending attention item and emits AttentionItemOpened
  it("opens an attention item by staging it and emitting AttentionItemOpened", async () => {
    const openedAt = decodeUtc("2026-05-08T10:10:00.000Z");

    const result = await Effect.runPromise(
      openAttentionItem(baseState(), {
        kind: "manual_review_required",
        openedAt
      })
    );

    expect(result.nextState.pendingAttentionItems).toEqual([
      { kind: "manual_review_required", openedAt, status: "open" }
    ]);
    expect(result.facts.map((fact) => fact._tag)).toEqual(["AttentionItemOpened"]);
  });

  // Scenario: Given a task with an open attention item
  // When resolution is requested
  // Then the domain marks the item resolved and emits AttentionItemResolved
  it("resolves an open attention item and emits AttentionItemResolved", async () => {
    const attentionItemId = Schema.decodeUnknownSync(AttentionItemId)("attention-1");

    const result = await Effect.runPromise(
      resolveAttentionItem(
        baseState({
          attentionItems: [makeAttentionItem("open")]
        }),
        { attentionItemId }
      )
    );

    const resolved = result.nextState.attentionItems.find(
      (item) => item.id === attentionItemId
    );
    expect(resolved?.status).toBe("resolved");
    expect(result.facts.map((fact) => fact._tag)).toEqual(["AttentionItemResolved"]);
  });
});
