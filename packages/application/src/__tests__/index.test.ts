import { DateTime, Effect, Layer, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ClaimMarkerFailed,
  ClaimMarkerPort,
  EligibilityRuleViolated,
  IdGenerator,
  MemoryRecordPort,
  RepositoryConflict,
  RepositoryUnavailable,
  TaskLifecycleRepository,
  TrackerProjectionFailed,
  TrackerProjectionPort,
  WallClockLive
} from "../index";
import {
  type TaskId,
  type TaskLifecycleState,
  TaskNotEligibleForClaim,
  WallClock
} from "@talby/workforce-domain";

const decodeTaskId = (value: string): TaskId =>
  Schema.decodeUnknownSync(Schema.String.pipe(Schema.brand("TaskId")))(value);

describe("application package foundation", () => {
  it("exports tagged application errors", () => {
    expect(new RepositoryUnavailable()._tag).toBe("RepositoryUnavailable");
    expect(new RepositoryConflict()._tag).toBe("RepositoryConflict");
    expect(new TrackerProjectionFailed()._tag).toBe("TrackerProjectionFailed");
    expect(new ClaimMarkerFailed()._tag).toBe("ClaimMarkerFailed");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });

  it("exposes service tags for Phase 5 application ports", async () => {
    const taskId = decodeTaskId("task-1");
    const serviceCalls: Array<string> = [];
    const repositoryLayer = Layer.succeed(TaskLifecycleRepository, {
      load: (requestedTaskId: TaskId) => {
        serviceCalls.push(`load:${requestedTaskId}`);
        return Effect.succeed(Option.none<TaskLifecycleState>());
      },
      save: () => {
        serviceCalls.push("save");
        return Effect.void;
      }
    });
    const idGeneratorLayer = Layer.succeed(IdGenerator, {
      generate: <Id extends string>(kind: string) => {
        serviceCalls.push(`id:${kind}`);
        return Effect.succeed(`${kind}-1` as Id);
      }
    });
    const trackerLayer = Layer.succeed(TrackerProjectionPort, {
      project: () => {
        serviceCalls.push("tracker");
        return Effect.void;
      }
    });
    const claimMarkerLayer = Layer.succeed(ClaimMarkerPort, {
      project: () => {
        serviceCalls.push("claim-marker");
        return Effect.void;
      }
    });
    const memoryLayer = Layer.succeed(MemoryRecordPort, {
      record: () => {
        serviceCalls.push("memory");
        return Effect.void;
      }
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TaskLifecycleRepository;
        const idGenerator = yield* IdGenerator;
        const trackerProjection = yield* TrackerProjectionPort;
        const claimMarker = yield* ClaimMarkerPort;
        const memoryRecord = yield* MemoryRecordPort;

        yield* repository.load(taskId);
        yield* idGenerator.generate("claim");
        yield* trackerProjection.project({} as TaskLifecycleState, []);
        yield* claimMarker.project({} as TaskLifecycleState, []);
        yield* memoryRecord.record({} as TaskLifecycleState, []);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            repositoryLayer,
            idGeneratorLayer,
            trackerLayer,
            claimMarkerLayer,
            memoryLayer
          )
        )
      )
    );

    expect(serviceCalls).toEqual([
      "load:task-1",
      "id:claim",
      "tracker",
      "claim-marker",
      "memory"
    ]);
  });

  it("provides a WallClock layer backed by Effect Clock", async () => {
    const before = Date.now();

    const now = await Effect.runPromise(
      Effect.gen(function* () {
        const wallClock = yield* WallClock;
        return yield* wallClock.now;
      }).pipe(Effect.provide(WallClockLive))
    );

    const after = Date.now();

    expect(DateTime.toEpochMillis(now)).toBeGreaterThanOrEqual(before);
    expect(DateTime.toEpochMillis(now)).toBeLessThanOrEqual(after);
  });

  it("keeps domain and application errors distinct in the combined layer surface", () => {
    expect(new TaskNotEligibleForClaim()._tag).toBe("TaskNotEligibleForClaim");
    expect(new EligibilityRuleViolated()._tag).toBe("EligibilityRuleViolated");
  });
});
