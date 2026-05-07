import { Schema } from "effect";

export const TaskId = Schema.String.pipe(Schema.brand("TaskId"));
export type TaskId = Schema.Schema.Type<typeof TaskId>;

export const WorkspaceId = Schema.String.pipe(Schema.brand("WorkspaceId"));
export type WorkspaceId = Schema.Schema.Type<typeof WorkspaceId>;

export const ConversationId = Schema.String.pipe(
  Schema.brand("ConversationId")
);
export type ConversationId = Schema.Schema.Type<typeof ConversationId>;

export const ClaimId = Schema.String.pipe(Schema.brand("ClaimId"));
export type ClaimId = Schema.Schema.Type<typeof ClaimId>;

export const WorkflowRunId = Schema.String.pipe(Schema.brand("WorkflowRunId"));
export type WorkflowRunId = Schema.Schema.Type<typeof WorkflowRunId>;

export const WorkflowId = Schema.String.pipe(Schema.brand("WorkflowId"));
export type WorkflowId = Schema.Schema.Type<typeof WorkflowId>;

export const AttentionItemId = Schema.String.pipe(
  Schema.brand("AttentionItemId")
);
export type AttentionItemId = Schema.Schema.Type<typeof AttentionItemId>;
