import { DateTime, Option } from "effect";

import type {
  AttentionItemId,
  ClaimId,
  ConversationId,
  TaskId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId
} from "../ids/index";
import type { AttentionItemStatus, Lease, Stage } from "../values";

export type SourceReference = Readonly<{
  trackerId: string;
  recordId: string;
}>;

export type RepositoryTargetContext = Readonly<{
  repositoryId: string;
  role: "read" | "write";
}>;

export type ExecutionStatus =
  | "running"
  | "paused"
  | "waiting_for_attention"
  | "completed"
  | "failed"
  | "handed_off"
  | "canceled";

export type ExecutionState = Readonly<{
  status: ExecutionStatus;
  updatedAt: DateTime.Utc;
}>;

export const terminalExecutionStatuses = [
  "completed",
  "failed",
  "handed_off",
  "canceled"
] as const satisfies ReadonlyArray<ExecutionStatus>;

const terminalExecutionStatusSet: ReadonlySet<ExecutionStatus> = new Set(
  terminalExecutionStatuses
);

export const isTerminalExecutionState = (
  executionState: ExecutionState
): boolean => terminalExecutionStatusSet.has(executionState.status);

export type Claim = Readonly<{
  id: ClaimId;
  workflowId: WorkflowId;
  lease: Lease;
}>;

export type NewClaim = Readonly<{
  workflowId: WorkflowId;
  lease: Lease;
}>;

export type ActiveWorkflowRun = Readonly<{
  id: WorkflowRunId;
  workflowId: WorkflowId;
  claimId: ClaimId;
}>;

export type NewWorkflowRun = Readonly<{
  workflowId: WorkflowId;
  claimId: ClaimId;
}>;

export type AttentionItemKind =
  | "manual_review_required"
  | "workflow_run_failed";

export type AttentionItem = Readonly<{
  id: AttentionItemId;
  status: AttentionItemStatus;
  kind: AttentionItemKind;
  openedAt: DateTime.Utc;
}>;

export type NewAttentionItem = Readonly<{
  status: AttentionItemStatus;
  kind: AttentionItemKind;
  openedAt: DateTime.Utc;
}>;

export type TaskLifecycleState = Readonly<{
  taskId: TaskId;
  workspaceId: WorkspaceId;
  stage: Stage;
  executionState: Option.Option<ExecutionState>;
  activeClaim: Option.Option<Claim>;
  activeWorkflowRun: Option.Option<ActiveWorkflowRun>;
  attentionItems: ReadonlyArray<AttentionItem>;
  conversationId: ConversationId;
  sourceReference: SourceReference;
  repositoryTargets: ReadonlyArray<RepositoryTargetContext>;
  pendingActiveClaim: Option.Option<NewClaim>;
  pendingActiveWorkflowRun: Option.Option<NewWorkflowRun>;
  pendingAttentionItems: ReadonlyArray<NewAttentionItem>;
}>;
