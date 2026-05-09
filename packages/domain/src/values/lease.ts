import { DateTime, Duration, Schema } from "effect";

export const Lease = Schema.Struct({
  createdAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
  renewalWindow: Schema.Duration
});

export type Lease = Schema.Schema.Type<typeof Lease>;

export const makeLease = (params: {
  createdAt: DateTime.Utc;
  leaseDuration: Duration.Duration;
  renewalWindow: Duration.Duration;
}): Lease => {
  if (!Duration.isPositive(params.leaseDuration)) {
    throw new RangeError(
      "leaseDuration must be positive when constructing Lease from createdAt"
    );
  }

  if (Duration.isNegative(params.renewalWindow)) {
    throw new RangeError(
      "renewalWindow must be non-negative when constructing Lease from createdAt"
    );
  }

  if (Duration.isGreaterThan(params.renewalWindow, params.leaseDuration)) {
    throw new RangeError(
      "renewalWindow must not be greater than leaseDuration when constructing Lease from createdAt"
    );
  }

  return {
    createdAt: params.createdAt,
    expiresAt: DateTime.addDuration(params.createdAt, params.leaseDuration),
    renewalWindow: params.renewalWindow
  };
};
