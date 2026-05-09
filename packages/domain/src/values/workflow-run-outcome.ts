import { Schema } from "effect";

export const WorkflowRunOutcome = Schema.Literals([
  "completed",
  "handed_off",
  "failed",
  "canceled"
]);

export type WorkflowRunOutcome = Schema.Schema.Type<typeof WorkflowRunOutcome>;
