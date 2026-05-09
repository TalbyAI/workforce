import { Context, DateTime, Effect } from "effect";

export interface WallClockService {
  readonly now: Effect.Effect<DateTime.Utc>;
}

export class WallClock extends Context.Service<WallClock, WallClockService>()(
  "@talby/workforce-domain/WallClock"
) {}
