import { Schema } from "effect";

export const AttentionItemStatus = Schema.Literals(["open", "resolved"]);

export type AttentionItemStatus = Schema.Schema.Type<
  typeof AttentionItemStatus
>;
