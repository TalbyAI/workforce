import { Clock, DateTime, Effect, Layer } from "effect";

import { WallClock } from "@talby/workforce-domain";

const currentTime = Effect.flatMap(Clock.currentTimeMillis, (epochMillis) =>
  Effect.succeed(DateTime.makeUnsafe(epochMillis))
);

export const WallClockLive = Layer.succeed(WallClock, {
  now: currentTime
});
