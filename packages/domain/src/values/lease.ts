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
  if (
    Duration.isGreaterThanOrEqualTo(params.renewalWindow, params.leaseDuration)
  ) {
    throw new RangeError("renewalWindow must be less than leaseDuration");
  }

  return {
    createdAt: params.createdAt,
    expiresAt: DateTime.addDuration(params.createdAt, params.leaseDuration),
    renewalWindow: params.renewalWindow
  };
};
