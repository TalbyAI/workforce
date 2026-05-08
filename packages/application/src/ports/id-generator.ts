import { Context, Effect } from "effect";

import type {
  AttentionItemId,
  ClaimId,
  WorkflowRunId
} from "@talby/workforce-domain";

export type IdByKind = {
  claim: ClaimId;
  "workflow-run": WorkflowRunId;
  "attention-item": AttentionItemId;
};

export interface IdGeneratorService {
  readonly generate: <K extends keyof IdByKind>(
    kind: K
  ) => Effect.Effect<IdByKind[K]>;
}

export class IdGenerator extends Context.Service<
  IdGenerator,
  IdGeneratorService
>()("@talby/workforce-application/IdGenerator") {}
