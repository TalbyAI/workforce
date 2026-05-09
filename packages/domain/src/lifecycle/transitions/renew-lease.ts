import { DateTime, Effect, Option, type Duration } from "effect";

import type { ClaimId } from "../../ids";
import { WallClock } from "../../services/wall-clock";
import { makeLease } from "../../values";
import { InvalidClaimOwner, LeaseExpired, NoActiveClaim } from "../errors";
import { LeaseRenewed } from "../facts";
import type { TaskLifecycleState } from "../state";
import type { DomainTransition } from "./shared";

export type RenewLeaseIntent = Readonly<{
  claimId: ClaimId;
  leaseDuration: Duration.Duration;
  renewalWindow: Duration.Duration;
}>;

export const renewLease = (
  state: TaskLifecycleState,
  intent: RenewLeaseIntent
): DomainTransition<WallClock> =>
  Effect.gen(function* () {
    if (Option.isNone(state.activeClaim)) {
      return yield* Effect.fail(new NoActiveClaim());
    }

    const activeClaim = state.activeClaim.value;

    if (activeClaim.id !== intent.claimId) {
      return yield* Effect.fail(new InvalidClaimOwner());
    }

    const wallClock = yield* WallClock;
    const now = yield* wallClock.now;

    if (DateTime.isGreaterThanOrEqualTo(now, activeClaim.lease.expiresAt)) {
      return yield* Effect.fail(new LeaseExpired());
    }

    const lease = makeLease({
      createdAt: now,
      leaseDuration: intent.leaseDuration,
      renewalWindow: intent.renewalWindow
    });

    return {
      nextState: {
        ...state,
        activeClaim: Option.some({
          ...activeClaim,
          lease
        })
      },
      facts: [
        new LeaseRenewed({
          taskId: state.taskId,
          claimId: activeClaim.id,
          lease
        })
      ]
    };
  });
