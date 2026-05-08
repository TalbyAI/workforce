import { Context, Effect, Option } from "effect";

import type { DomainFact, TaskLifecycleState, TaskId } from "@talby/workforce-domain";

export interface TaskLifecycleRepositoryService {
  readonly load: (
    taskId: TaskId
  ) => Effect.Effect<Option.Option<TaskLifecycleState>>;
  readonly save: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void>;
}

export class TaskLifecycleRepository extends Context.Service<
  TaskLifecycleRepository,
  TaskLifecycleRepositoryService
>()("@talby/workforce-application/TaskLifecycleRepository") {}
