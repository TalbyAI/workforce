import { Context, Effect, Option } from "effect";

import type { DomainFact, TaskLifecycleState, TaskId } from "@talby/workforce-domain";
import type {
  RepositoryConflict,
  RepositoryUnavailable
} from "../errors";

export interface TaskLifecycleRepositoryService {
  readonly load: (
    taskId: TaskId
  ) => Effect.Effect<Option.Option<TaskLifecycleState>, RepositoryUnavailable>;
  readonly save: (
    state: TaskLifecycleState,
    facts: ReadonlyArray<DomainFact>
  ) => Effect.Effect<void, RepositoryConflict | RepositoryUnavailable>;
}

export class TaskLifecycleRepository extends Context.Service<
  TaskLifecycleRepository,
  TaskLifecycleRepositoryService
>()("@talby/workforce-application/TaskLifecycleRepository") {}
