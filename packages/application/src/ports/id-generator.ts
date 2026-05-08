import { Context, Effect } from "effect";

export interface IdGeneratorService {
  readonly generate: <Id extends string>(kind: string) => Effect.Effect<Id>;
}

export class IdGenerator extends Context.Service<
  IdGenerator,
  IdGeneratorService
>()("@talby/workforce-application/IdGenerator") {}
