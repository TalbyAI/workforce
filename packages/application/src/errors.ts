import { Data } from "effect";

export class RepositoryUnavailable extends Data.TaggedError(
  "RepositoryUnavailable"
) {}

export class RepositoryConflict extends Data.TaggedError(
  "RepositoryConflict"
) {}

export class TrackerProjectionFailed extends Data.TaggedError(
  "TrackerProjectionFailed"
) {}

export class ClaimMarkerFailed extends Data.TaggedError("ClaimMarkerFailed") {}

export class MemoryRecordWriteFailed extends Data.TaggedError(
  "MemoryRecordWriteFailed"
) {}

export class EligibilityRuleViolated extends Data.TaggedError(
  "EligibilityRuleViolated"
) {}

export type ApplicationError =
  | RepositoryUnavailable
  | RepositoryConflict
  | TrackerProjectionFailed
  | ClaimMarkerFailed
  | MemoryRecordWriteFailed
  | EligibilityRuleViolated;
