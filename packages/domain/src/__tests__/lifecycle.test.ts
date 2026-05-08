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
  type NewAttentionItem,
  Stage,
  TaskId,
  TaskAlreadyClaimed,
  type TaskLifecycleState,
  WorkflowId,
  WorkflowRunId,
  WorkflowRunAlreadyActive,
  InvalidHandoff,
  WallClock,
  WorkspaceId,
  claimTask,
  failWorkflowRun,
  handoffTask,
  makeLease,
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
});
