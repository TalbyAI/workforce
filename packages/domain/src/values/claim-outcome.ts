import { Schema } from "effect";

export const ClaimOutcome = Schema.Literals([
  "completed",
  "handed_off",
  "abandoned",
  "expired",
  "revoked",
  "failed"
]);

export type ClaimOutcome = Schema.Schema.Type<typeof ClaimOutcome>;
