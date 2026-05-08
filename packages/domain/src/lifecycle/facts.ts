import { Data } from "effect";

import type {
  AttentionItemId,
  ClaimId,
  TaskId,
  WorkflowId,
  WorkflowRunId
} from "../ids";
import type { ClaimOutcome, Lease, WorkflowRunOutcome } from "../values";
import type { AttentionItemKind } from "./state";

export class ClaimAcquired extends Data.TaggedClass("ClaimAcquired")<{
  readonly taskId: TaskId;
  readonly workflowId: WorkflowId;
  readonly lease: Lease;
}> {}

export class LeaseRenewed extends Data.TaggedClass("LeaseRenewed")<{
  readonly taskId: TaskId;
  readonly claimId: ClaimId;
  readonly lease: Lease;
}> {}

export class ClaimReleased extends Data.TaggedClass("ClaimReleased")<{
  readonly taskId: TaskId;
  readonly claimId: ClaimId;
  readonly outcome: ClaimOutcome;
}> {}

export class WorkflowRunStarted extends Data.TaggedClass("WorkflowRunStarted")<{
  readonly taskId: TaskId;
  readonly workflowId: WorkflowId;
  readonly claimId: ClaimId;
}> {}

export class WorkflowRunCompleted extends Data.TaggedClass(
  "WorkflowRunCompleted"
)<{
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly outcome: WorkflowRunOutcome;
}> {}

export class WorkflowRunFailed extends Data.TaggedClass("WorkflowRunFailed")<{
  readonly taskId: TaskId;
  readonly workflowRunId: WorkflowRunId;
  readonly workflowId: WorkflowId;
}> {}

export class TaskHandedOff extends Data.TaggedClass("TaskHandedOff")<{
  readonly taskId: TaskId;
}> {}

export class AttentionItemOpened extends Data.TaggedClass(
  "AttentionItemOpened"
)<{
  readonly taskId: TaskId;
  readonly kind: AttentionItemKind;
}> {}

export class AttentionItemResolved extends Data.TaggedClass(
  "AttentionItemResolved"
)<{
  readonly taskId: TaskId;
  readonly attentionItemId: AttentionItemId;
}> {}

export type DomainFact =
  | ClaimAcquired
  | LeaseRenewed
  | ClaimReleased
  | WorkflowRunStarted
  | WorkflowRunCompleted
  | WorkflowRunFailed
  | TaskHandedOff
  | AttentionItemOpened
  | AttentionItemResolved;
