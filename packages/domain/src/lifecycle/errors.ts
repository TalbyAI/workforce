import { Data } from "effect";

import type { ClaimOutcome } from "../values";

export class TaskNotEligibleForClaim extends Data.TaggedError(
  "TaskNotEligibleForClaim"
) {}

export class TaskAlreadyClaimed extends Data.TaggedError(
  "TaskAlreadyClaimed"
) {}

export class NoActiveClaim extends Data.TaggedError("NoActiveClaim") {}

export class LeaseExpired extends Data.TaggedError("LeaseExpired") {}

export class WorkflowRunAlreadyActive extends Data.TaggedError(
  "WorkflowRunAlreadyActive"
) {}

export class WorkflowRunNotActive extends Data.TaggedError(
  "WorkflowRunNotActive"
) {}

export class AttentionItemNotOpen extends Data.TaggedError(
  "AttentionItemNotOpen"
) {}

export class InvalidHandoff extends Data.TaggedError("InvalidHandoff") {}

export class InvalidClaimOwner extends Data.TaggedError("InvalidClaimOwner") {}

export class ClaimOutcomeNotAllowed extends Data.TaggedError(
  "ClaimOutcomeNotAllowed"
)<{
  readonly outcome: ClaimOutcome;
}> {}

export type DomainError =
  | TaskNotEligibleForClaim
  | TaskAlreadyClaimed
  | NoActiveClaim
  | LeaseExpired
  | WorkflowRunAlreadyActive
  | WorkflowRunNotActive
  | AttentionItemNotOpen
  | InvalidHandoff
  | InvalidClaimOwner
  | ClaimOutcomeNotAllowed;
