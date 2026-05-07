# Core Domain Model Design

## Status

- Date: 2026-05-05
- Updated: 2026-05-07
- Scope: Core domain and workflow lifecycle first slice
- Target packages: `@talby/workforce-domain`, `@talby/workforce-application`
- Chosen style: Effect-native functional domain with explicit use-case modules

## Goal

Define the first implementation slice of Talby Workforce around the core workflow lifecycle so later packages can depend on one authoritative model for claim, handoff, workflow run, and attention behavior without re-deciding domain rules in adapters or handlers.

This slice covers domain types and application-service ports. It does not define persistence schemas, external adapter implementations, transport APIs, or full event sourcing.

## Why This Slice First

The current repository has a strong domain language in [CONTEXT.md](../../CONTEXT.md) but no implementation in `@talby/workforce-domain` or `@talby/workforce-application` yet. The first useful boundary is therefore the core lifecycle model that governs how a Task moves through claim and execution state.

That model is foundational because all of the following depend on it:

- tracker ingestion and eligibility decisions
- workflow execution orchestration
- memory and tracker projections
- operator attention handling
- later adapter and storage design

If these rules are not centralized first, they will leak into workflow handlers, tracker adapters, and UI-facing services.

## Scope

### In Scope

- immutable domain state for the workflow lifecycle
- domain value objects and fixed vocabularies
- pure domain transition functions
- typed domain errors
- application-level use-case modules
- inbound and outbound ports required by those use cases
- testing strategy for domain and application layers

### Out of Scope

- database schema design
- event store design
- concrete tracker, memory, git, or workflow-engine adapters
- HTTP or CLI interfaces
- repository routing heuristics beyond the minimum state references required by lifecycle decisions
- full Conversation and memory-query behavior outside what lifecycle use cases must reference
- detailed workflow-step execution configuration beyond the lifecycle references required by claim and run transitions

## Design Principles

1. Domain rules live in `@talby/workforce-domain`.
2. Domain transitions return `Effect` values. Most transitions have `R = never`; only transitions that need the current time may carry a `WallClock` service in `R`.
3. Application use cases orchestrate ports but do not redefine rules.
4. Infrastructure concerns stay outside `@talby/workforce-domain` and `@talby/workforce-application`.
5. Errors use domain language, not generic strings. Both domain and operational errors are modeled as `Data.TaggedError` variants.
6. Tests should read like executable domain examples.

## Architecture

The first slice should define two packages: `@talby/workforce-domain` for the domain layer and `@talby/workforce-application` for the application layer. `@talby/workforce-application` declares `@talby/workforce-domain` as a dependency. The previously proposed `@talby/core` package is not used; there is no umbrella re-export package in this slice.

This slice should also stay aligned with the current language in [CONTEXT.md](../../CONTEXT.md):

- `Capability Profile` is not part of the model
- an `Agent` declares its own `Tools`
- a `Skill` is a reusable instruction asset that may be available during execution and may also be directly invocable when its metadata allows it
- a `Workflow` and its steps may declare available `Agents` and `Skills`, with explicit `replace` or `merge` semantics when a step overrides workflow defaults
- a step may declare `Agents` or `Skills` that were not declared at workflow level, but it must declare them explicitly rather than relying on implicit global discovery

Those constraints matter here because later workflow-engine and execution-package work must depend on `@talby/workforce-domain` without reintroducing a different capability model.

### Domain Layer

The domain layer owns Talby's workflow lifecycle language and invariants. It defines immutable state shapes such as:

- `Task`
- `TaskId`
- `WorkspaceId`
- `ConversationId`
- `Stage`
- `StageVocabularyId`
- `ExecutionState`
- `Claim`
- `Lease`
- `ClaimOutcome`
- `WorkflowRun`
- `WorkflowRunOutcome`
- `AttentionItem`
- `AttentionItemStatus`

It also defines pure transition functions that enforce invariants. Examples:

- a Task cannot be claimed if it already has an active Claim
- only a Workflow Run may own a Claim
- a Handoff normally releases the active Claim
- a failed Workflow Run creates at least one Attention Item
- a Task has at most one active Workflow Run in v1

Domain transition functions return `Effect` values. Most transitions return `Effect<{ nextState: TaskLifecycleState; facts: ReadonlyArray<DomainFact> }, DomainError, never>`. Only transitions that need the current time, such as `claimTask` and `renewLease`, may carry a `WallClock` service in `R` to access it from context. Read-only predicates such as `checkClaimEligibility` keep `R = never`. No domain transition has an `R` channel beyond `WallClock`. The domain layer does not talk to repositories or any other external systems.

### Application Layer

The application layer defines explicit use cases around the lifecycle transitions. Example modules:

- `claimTaskForWorkflow`
- `renewClaimLease`
- `releaseClaim`
- `startWorkflowRun`
- `completeWorkflowRun`
- `failWorkflowRun`
- `handoffTask`
- `openAttentionItem`
- `resolveAttentionItem`

Each use case loads current state through ports, calls pure domain functions, persists the resulting state, then projects the resulting domain facts outward through outbound ports.

Application code may coordinate side effects, retries, id generation, and time lookup, but it must not introduce lifecycle rules that contradict or bypass the domain layer.

For this slice, application code should treat workflow execution configuration as an upstream input. The lifecycle model may refer to the existence of a selected `Workflow` or active `Workflow Run`, but it should not embed step-level `Agent`, `Skill`, or `Tool` orchestration rules in the lifecycle state machine.

## Module Boundaries

Both packages are organized around domain concepts and use-case seams rather than transport or database boundaries.

`@talby/workforce-domain` owns lifecycle language, invariants, and transitions:

```text
packages/domain/src/
  ids/
  services/
    wall-clock.ts           ← WallClock Context.Tag; used in R channel by time-sensitive transitions
  values/
    claim-outcome.ts        ← Schema.Literal union
    workflow-run-outcome.ts ← Schema.Literal union
    lease.ts
    stage.ts
  lifecycle/
    state.ts                ← TaskLifecycleState with Option<T> fields
    errors.ts               ← Data.TaggedError variants; DomainError union
    facts.ts                ← Data.TaggedClass variants; DomainFact union
    transitions/
      check-claim-eligibility.ts
      claim-task.ts
      renew-lease.ts
      release-claim.ts
      start-workflow-run.ts
      complete-workflow-run.ts
      fail-workflow-run.ts
      handoff-task.ts
      attention-item.ts
  index.ts
```

`@talby/workforce-application` owns use cases and ports, and depends on `@talby/workforce-domain`:

```text
packages/application/src/
  errors.ts                           ← Data.TaggedError variants; ApplicationError union
  ports/
    task-lifecycle-repository.ts      ← Context.Tag service class
    clock.ts                          ← Layer satisfying WallClock from @talby/workforce-domain using Effect's Clock
    id-generator.ts                   ← Context.Tag service class
    tracker-projection-port.ts        ← Context.Tag service class
    claim-marker-port.ts              ← Context.Tag service class
    memory-record-port.ts             ← Context.Tag service class
  use-cases/
    claim-task-for-workflow.ts
    renew-claim-lease.ts
    release-claim.ts
    start-workflow-run.ts
    complete-workflow-run.ts
    fail-workflow-run.ts
    handoff-task.ts
    open-attention-item.ts
    resolve-attention-item.ts
  index.ts
```

This keeps domain transitions local and predictable while giving the application layer explicit `Context.Tag` seams for orchestration.

## Core State Model

The first slice should center on a `TaskLifecycleState` bundle. This is the smallest coherent state required to make legal lifecycle decisions.

### TaskLifecycleState

`TaskLifecycleState` should include:

- Task identity and workspace identity
- current Stage
- current Execution State, if any
- active Claim, if any
- active Workflow Run, if any
- open Attention Items
- Conversation reference
- Source Reference and minimal repository-targeting context required by lifecycle decisions
- `pendingActiveClaim: Option<NewClaim>` — set by `claimTask`; drained by the application before persisting
- `pendingActiveWorkflowRun: Option<NewWorkflowRun>` — set by `startWorkflowRun`; drained by the application before persisting
- `pendingAttentionItems: ReadonlyArray<NewAttentionItem>` — set by `failWorkflowRun` and `openAttentionItem`; drained by the application before persisting

This bundle is a domain convenience boundary, not a database record design. Its purpose is to ensure lifecycle functions receive the full local context required to enforce invariants.

`TaskLifecycleState` should not include the full workflow-step execution configuration. In particular, it should not carry step-level `Agent`, `Skill`, or `Tool` availability beyond the minimum references needed to validate claim ownership, active run identity, and handoff or failure consequences.

### Supporting Types

The following supporting types should be explicit and narrow:

- **Branded identifiers**: `Schema.String.pipe(Schema.brand("TaskId"))` etc. from `effect/Schema`. Construction goes through schema decode; the inferred type is automatically branded. Plain TypeScript intersection brands and `Data.TaggedClass` id objects are not used.
- **Fixed vocabularies**: `Schema.Literal` unions for `ClaimOutcome` (`"completed" | "handed_off" | "abandoned" | "expired" | "revoked" | "failed"`) and `WorkflowRunOutcome`. These schemas serve as built-in codecs for future serialization. Plain `const` object brands and TypeScript `enum` are not used.
- **Optional fields**: `Option<T>` from `effect/Option` for absent-or-present fields such as `activeClaim`, `activeWorkflowRun`, and `executionState`. `T | undefined` and `T | null` are not used.
- Explicit lease timestamps and renewal windows
- Explicit attention status values
- Explicit stage and workspace references

The current fixed vocabularies from [CONTEXT.md](../../CONTEXT.md) should be preserved as authoritative inputs to the model.

## Domain API Shape

The domain API should be organized around transitions, not CRUD.

Each transition function should accept:

- current `TaskLifecycleState`
- a typed intent object containing only the data needed for the transition

Each transition function should return:

- `Effect<{ nextState: TaskLifecycleState; facts: ReadonlyArray<DomainFact> }, DomainError, never>` for most transitions
- `Effect<{ nextState: TaskLifecycleState; facts: ReadonlyArray<DomainFact> }, DomainError, WallClock>` for time-sensitive transitions that require the current time

`checkClaimEligibility` is a separate read-only predicate with signature `(state: TaskLifecycleState) => Effect<void, TaskNotEligibleForClaim | TaskAlreadyClaimed, never>`. It checks lifecycle preconditions only: absence of an active Claim and absence of a terminal execution state. It does not evaluate Workspace Eligibility Rules — that is the responsibility of the application layer, which emits `EligibilityRuleViolated` if rules are not met. It does not return updated state. It is callable independently by the ingestion path for pre-flight checks. `claimTask` internally reuses the same guard so eligibility is always enforced on mutation.

Suggested transition surface:

- `checkClaimEligibility`
- `claimTask`
- `renewLease`
- `releaseClaim`
- `startWorkflowRun`
- `completeWorkflowRun`
- `failWorkflowRun`
- `handoffTask`
- `openAttentionItem`
- `resolveAttentionItem`

The functions should remain small and composable. If a use case needs multiple domain steps, the application layer composes them explicitly rather than creating a giant kitchen-sink transition.

## Domain Facts

Successful transitions should emit typed domain facts. These are internal outputs of accepted domain transitions, not infrastructure events.

Examples:

- `ClaimAcquired`
- `LeaseRenewed`
- `ClaimReleased`
- `WorkflowRunStarted`
- `WorkflowRunCompleted`
- `WorkflowRunFailed`
- `TaskHandedOff`
- `AttentionItemOpened`
- `AttentionItemResolved`

Facts are modeled as `Data.TaggedClass` instances. This gives structural equality for test assertions and tagged discrimination (`_tag`) for routing in the application layer. Transitions return facts as `ReadonlyArray<DomainFact>` in the success value alongside `nextState`. Effect Queue and PubSub are not used for fact delivery in this slice.

These facts give the application layer a structured basis for persistence follow-up and outbound projections without coupling the domain to transport or storage.

## Application Ports

Each port is a `Context.Tag` service class in `@talby/workforce-application`. Use cases declare their port requirements in the `R` channel and receive implementations via `Layer.succeed` or `Layer.effect` at the application boundary. Tests provide `Layer.succeed` fakes. Plain TypeScript interfaces as function arguments are not used.

Initial ports:

- `TaskLifecycleRepository`
- `WallClock` (tag defined in `@talby/workforce-domain`; `Layer` implementation in `@talby/workforce-application`)
- `IdGenerator`
- `TrackerProjectionPort`
- `ClaimMarkerPort`
- `MemoryRecordPort`

### TaskLifecycleRepository

Loads and saves `TaskLifecycleState`. It may later support optimistic concurrency, but that policy should not be embedded into the domain layer.

### WallClock

Provides the current time for lease creation, lease renewal, and other time-sensitive transitions that need it. The `WallClock` `Context.Tag` is defined in `@talby/workforce-domain` so domain transitions can declare it in their `R` channel without depending on `@talby/workforce-application`. The `@talby/workforce-application` package provides a `Layer.effect` backed by Effect's built-in `Clock` service.

### IdGenerator

Generates identifiers for new Attention Items or other application-created records.

### TrackerProjectionPort

Requests outbound updates to the External Tracker after accepted lifecycle transitions.

### ClaimMarkerPort

Handles tracker-specific representation of active claim ownership when separated from broader tracker projections.

### MemoryRecordPort

Requests append-only First-Hand Records related to lifecycle transitions when the application layer decides that a transition should be reflected in memory.

## Use-Case Behavior

Each use case should follow the same orchestration order:

1. load current lifecycle state
2. execute one or more pure domain transitions
3. enrich `nextState` by assigning IDs to all pending entities (`pendingActiveClaim`, `pendingActiveWorkflowRun`, `pendingAttentionItems`) via `IdGenerator`
4. persist enriched state (the repository rejects state with non-empty pending fields)
5. project resulting facts through outbound ports

This ordering matters.

- domain code decides whether a transition is legal
- application assigns IDs to all pending entities before persisting
- persistence stores the enriched, fully-valid state
- outbound ports publish consequences to external systems

External systems never decide whether a Claim is legal or whether a Workflow Run may end. They only receive the consequences after the domain accepts the change.

## Example Flows

### Claim Task For Workflow

1. load `TaskLifecycleState`
2. application layer evaluates Workspace Eligibility Rules; fails with `EligibilityRuleViolated` if not met
3. call domain `checkClaimEligibility` — verifies no active Claim and no terminal state
4. call domain `claimTask` — creates `NewClaim` in `pendingActiveClaim` and a `Lease` via `WallClock`
5. application assigns `ClaimId` via `IdGenerator`, drains `pendingActiveClaim` into `activeClaim`
6. persist enriched state
7. emit tracker and memory projections as needed

### Handoff Task

1. load `TaskLifecycleState`
2. call domain `handoffTask` — verifies active Claim, atomically releases Claim with outcome `handed_off`, and clears `activeWorkflowRun`; emits `ClaimReleased` + `TaskHandedOff`
3. no pending entities to enrich for this transition
4. persist new state
5. project handoff consequences outward

### Fail Workflow Run

1. load `TaskLifecycleState`
2. call domain `failWorkflowRun` — verifies active Workflow Run, atomically clears run, releases Claim, and appends `NewAttentionItem`(s) to `pendingAttentionItems`; emits `WorkflowRunFailed` + `ClaimReleased` + `AttentionItemOpened`
3. application assigns `AttentionItemId`(s) via `IdGenerator`, drains `pendingAttentionItems` into `openAttentionItems`
4. persist enriched state
5. project outward to tracker and memory channels

This directly matches the v1 invariant that a failed Workflow Run releases its Claim and requires human attention.

## Error Model

Both domain and operational errors are modeled as `Data.TaggedError` variants. Application code uses `Effect.catchTag` / `Effect.catchTags` to discriminate between them.

### Domain Errors

Domain errors represent violated lifecycle rules. They live in `@talby/workforce-domain` and appear in the `E` channel of domain transition functions.

Example domain errors (each a `Data.TaggedError` class):

- `TaskNotEligibleForClaim`
- `TaskAlreadyClaimed`
- `NoActiveClaim`
- `LeaseExpired`
- `WorkflowRunAlreadyActive`
- `WorkflowRunNotActive`
- `AttentionItemNotOpen`
- `InvalidHandoff`
- `InvalidClaimOwner`
- `ClaimOutcomeNotAllowed`

A `DomainError` type alias covers all variants.

### Application Errors

Operational failures live in `@talby/workforce-application` and represent infrastructure or side-effect failures that occur after the domain has accepted a transition.

Example application errors (each a `Data.TaggedError` class):

- `RepositoryUnavailable`
- `RepositoryConflict`
- `TrackerProjectionFailed`
- `ClaimMarkerFailed`
- `MemoryRecordWriteFailed`
- `EligibilityRuleViolated`

An `ApplicationError` type alias covers all variants.

### Combined Error Channel

Use-case `E` channels are typed as `DomainError | ApplicationError`. A failed tracker projection does not mean the lifecycle rule was invalid — it means the domain transition succeeded and an external side effect failed afterward. The two error classes are distinguished by `_tag` discrimination.

The first slice supports the outcome shape: domain accepted, persistence committed, outbound projection failed.

Plain string failures, generic `Error` throws, and wrapper types over success values are not used.

## Testing Strategy

Testing should center on lifecycle invariants and transition behavior.

### Domain Tests

Most coverage should be pure domain tests. These tests should verify:

- claiming an eligible Task succeeds
- claiming a Task with an active Claim fails
- lease renewal rules behave correctly
- claim release supports only allowed outcomes
- only one active Workflow Run may exist per Task in v1
- failing a Workflow Run releases the Claim and opens attention
- handoff without an active Claim fails
- resolving an already closed Attention Item fails

These tests should read like executable domain examples, not low-level implementation assertions.

### Application Tests

Application tests should use fakes for ports and verify:

- load -> transition -> persist -> project ordering
- no outbound projection occurs when the domain rejects the transition
- outbound failures are reported distinctly from domain failures
- the correct facts are mapped to the correct projection ports

No real database, tracker, memory system, or workflow engine is needed in this slice.

## Success Criteria

This slice succeeds when:

- another package can depend on `@talby/workforce-domain` for lifecycle types and transition logic
- another package can depend on `@talby/workforce-application` for use cases and port interfaces without owning lifecycle rules
- adapters do not need to re-implement claim and workflow rules
- typed domain errors and facts are sufficient for orchestrating side effects
- tests capture the key invariants from [CONTEXT.md](../../CONTEXT.md)
- the package boundaries are still narrow enough to extend later with persistence and adapters without breaking the domain shape
- later workflow execution work can add `Agent` and `Skill` orchestration without reintroducing `Capability Profile` or moving lifecycle rules out of `@talby/workforce-domain`

This slice fails if lifecycle rules are still duplicated in handlers, adapters, or UI-oriented services.

## Resolved Design Decisions

The following implementation decisions were made during design review and are binding for this slice. Rejected alternatives are recorded to prevent re-litigation.

| #   | Decision                    | Chosen                                                                                       | Rejected                                                                                       |
| --- | --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Domain function return type | `Effect<..., DomainError, R>` throughout                                                     | Plain discriminated union `{ ok: true, ... } \| { ok: false, ... }`; thin adapter re-wrap      |
| 2   | Package structure           | `@talby/workforce-domain` + `@talby/workforce-application`; `@talby/core` removed            | Single `@talby/core` package; subpath exports split (`@talby/core/domain`); umbrella re-export |
| 3   | Domain `R` channel          | `R = never` by default; only transitions that need current time may require `WallClock` in `R` | `R = never` for every transition; arbitrary or full service graph dependencies in domain `R` |
| 4   | Branded identifiers         | `Schema.String.pipe(Schema.brand(...))` from `effect/Schema`                                 | Plain TypeScript intersection brands; `Data.TaggedClass` id objects                            |
| 5   | Domain errors               | `Data.TaggedError` variants; `DomainError` union alias                                       | Plain discriminated union with `_tag` strings; `Schema.TaggedStruct`                           |
| 6   | Application ports           | `Context.Tag` service classes; `Layer.succeed` / `Layer.effect`                              | Plain TypeScript interfaces as function arguments; hybrid (core tags, side-effect callbacks)   |
| 7   | Domain facts                | `Data.TaggedClass` variants; `ReadonlyArray<DomainFact>` in success channel                  | Plain tagged objects; Effect Queue / PubSub fan-out                                            |
| 8   | Optional state fields       | `Option<T>` from `effect/Option`                                                             | `T \| undefined`; `T \| null`                                                                  |
| 9   | Fixed vocabularies          | `Schema.Literal` unions (`ClaimOutcome`, `WorkflowRunOutcome`)                               | `const` object + union type; TypeScript `enum`                                                 |
| 10  | Operational errors          | `ApplicationError` `Data.TaggedError` union; `E` channel = `DomainError \| ApplicationError` | Wrapper type with `projectionFailures` field on success; two-phase return                      |
| 11  | `checkClaimEligibility`     | Separate read-only predicate reused internally by `claimTask`                                | Fold eligibility into `claimTask` only; richer query object return                             |
| 12  | `WallClock` service name and home | `WallClock` `Context.Tag` defined in `@talby/workforce-domain`; `@talby/workforce-application` provides a `Layer` backed by Effect's `Clock` | Use Effect's built-in `Clock` name directly; define clock tag in `@talby/workforce-application` (circular dependency) |
| 13  | `TaskLifecycleState` scope  | Task-only in this slice; Subtask lifecycle explicitly deferred                               | Unified `LifecycleTarget` discriminated union covering Task and Subtask; `SubtaskId` brand added only |
| 14  | `activeWorkflowRun` shape   | Slim reference `{ id: WorkflowRunId; workflowId: WorkflowId; claimId: ClaimId }`            | Full `WorkflowRun` struct with timestamps; `WorkflowRunId` alone (insufficient for `InvalidClaimOwner` check) |
| 15  | `checkClaimEligibility` scope | Lifecycle preconditions only (no active Claim, not terminal state); Workspace Eligibility Rule evaluation is application responsibility; `EligibilityRuleViolated` lives in `@talby/workforce-application` | Domain evaluates Workspace Eligibility Rules; `isEligible: boolean` flag embedded in state |
| 16  | `handoffTask` atomicity     | Single domain transition atomically releases Claim and clears `activeWorkflowRun`; emits `ClaimReleased` + `TaskHandedOff` | Two-step application composition of `releaseClaim` + `endWorkflowRun`; outcome-driven `releaseClaim` branching |
| 17  | `failWorkflowRun` atomicity | Single domain transition atomically clears run, releases Claim, and appends `NewAttentionItem`(s) to `pendingAttentionItems`; emits `WorkflowRunFailed` + `ClaimReleased` + `AttentionItemOpened` | Two-step: domain fails run, application calls `openAttentionItem` separately |
| 18  | ID allocation pattern       | Consistent pending pattern: domain writes to `pendingActiveClaim`, `pendingActiveWorkflowRun`, or `pendingAttentionItems`; application drains and assigns IDs before persisting; repository rejects non-empty pending fields; use-case ordering is `load → transition → enrich → persist → project` | Application pre-generates all IDs before domain calls; mixed pattern (pending for collections only) |

## Implementation Tasks

The following tasks decompose this slice into independently reviewable units. Tasks within the same phase may proceed in parallel. Cross-phase blocking dependencies are stated explicitly.

### Phase 0 — Package Infrastructure

**T0 · Scaffold `@talby/workforce-domain` and `@talby/workforce-application`**

- Retire `packages/core` (`@talby/core` is not used in this slice per Decision #2)
- Create `packages/domain/` with `package.json`, `tsconfig.json`, `src/index.ts`; add `effect` as dependency
- Create `packages/application/` with `package.json`, `tsconfig.json`, `src/index.ts`; add `effect` and `@talby/workforce-domain` as dependencies
- Confirm both packages are covered by the existing `packages/*` glob in `pnpm-workspace.yaml`

_Blocks all subsequent tasks._

---

### Phase 1 — Domain Foundation

All three tasks depend on T0 and may proceed in parallel. All three block Phase 2.

**T1a · Branded identifiers** — `packages/domain/src/ids/`

- Define `TaskId`, `WorkspaceId`, `ConversationId`, `ClaimId`, `WorkflowRunId`, `WorkflowId`, `AttentionItemId` using `Schema.String.pipe(Schema.brand(...))`

_Depends on T0._

**T1b · `WallClock` service** — `packages/domain/src/services/wall-clock.ts`

- Define `WallClock` as a `Context.Tag` service class only; no implementation in this package

_Depends on T0._

**T1c · Value objects** — `packages/domain/src/values/`

- `ClaimOutcome` as a `Schema.Literal` union: `"completed" | "handed_off" | "abandoned" | "expired" | "revoked" | "failed"`
- `WorkflowRunOutcome` as a `Schema.Literal` union
- `Stage`, `StageVocabularyId`
- `Lease` struct with explicit timestamps and renewal window
- `AttentionItemStatus`

_Depends on T0._

---

### Phase 2 — Core State Model

All three tasks depend on Phase 1 and may proceed in parallel. All three block Phase 3.

**T2a · `TaskLifecycleState`** — `packages/domain/src/lifecycle/state.ts`

- Full bundle with `Option<T>` fields: `activeClaim`, `activeWorkflowRun`, `executionState`
- Slim `activeWorkflowRun` reference shape: `{ id: WorkflowRunId; workflowId: WorkflowId; claimId: ClaimId }`
- Pending fields: `pendingActiveClaim: Option<NewClaim>`, `pendingActiveWorkflowRun: Option<NewWorkflowRun>`, `pendingAttentionItems: ReadonlyArray<NewAttentionItem>`
- Task identity, workspace identity, stage, conversation reference, source reference

_Depends on T1a, T1c._

**T2b · `DomainError` variants** — `packages/domain/src/lifecycle/errors.ts`

- `Data.TaggedError` classes: `TaskNotEligibleForClaim`, `TaskAlreadyClaimed`, `NoActiveClaim`, `LeaseExpired`, `WorkflowRunAlreadyActive`, `WorkflowRunNotActive`, `AttentionItemNotOpen`, `InvalidHandoff`, `InvalidClaimOwner`, `ClaimOutcomeNotAllowed`
- `DomainError` union alias

_Depends on T1a._

**T2c · `DomainFact` variants** — `packages/domain/src/lifecycle/facts.ts`

- `Data.TaggedClass` instances: `ClaimAcquired`, `LeaseRenewed`, `ClaimReleased`, `WorkflowRunStarted`, `WorkflowRunCompleted`, `WorkflowRunFailed`, `TaskHandedOff`, `AttentionItemOpened`, `AttentionItemResolved`
- `DomainFact` union alias

_Depends on T1a, T1c._

---

### Phase 3 — Domain Transitions

Three parallel groups. Each group blocks its matching Phase 6 group.

**T3A · Claim transitions** — `packages/domain/src/lifecycle/transitions/`

- `check-claim-eligibility.ts` — read-only predicate; checks no active Claim and no terminal `ExecutionState`; reused internally by `claimTask`
- `claim-task.ts` — writes `NewClaim` to `pendingActiveClaim`; requires `WallClock`
- `renew-lease.ts` — requires `WallClock`
- `release-claim.ts`

_Depends on T2a, T2b, T2c, T1b._

**T3B · Workflow Run transitions** — `packages/domain/src/lifecycle/transitions/`

- `start-workflow-run.ts` — writes `NewWorkflowRun` to `pendingActiveWorkflowRun`
- `complete-workflow-run.ts`
- `fail-workflow-run.ts` — atomically clears run, releases Claim with outcome `failed`, appends `NewAttentionItem`(s) to `pendingAttentionItems`; emits `WorkflowRunFailed`, `ClaimReleased`, `AttentionItemOpened`

_Depends on T2a, T2b, T2c. Parallel with T3A._

**T3C · Attention and Handoff transitions** — `packages/domain/src/lifecycle/transitions/`

- `handoff-task.ts` — atomically releases Claim with outcome `handed_off` and clears `activeWorkflowRun`; emits `ClaimReleased`, `TaskHandedOff`
- `attention-item.ts` — `openAttentionItem` and `resolveAttentionItem`

_Depends on T2a, T2b, T2c. Parallel with T3A, T3B._

---

### Phase 4 — Domain Package Completion

**T4a · Domain `index.ts`** — `packages/domain/src/index.ts`

- Re-export all public ids, services, values, lifecycle state, errors, facts, and transitions

_Depends on T3A, T3B, T3C._

**T4b · Domain tests** — `packages/domain/src/__tests__/`

- Pure invariant tests covering:
  - claiming an eligible Task succeeds
  - claiming a Task with an active Claim fails
  - lease renewal rules behave correctly
  - claim release supports only allowed outcomes
  - only one active Workflow Run may exist per Task in v1
  - `failWorkflowRun` releases the Claim and opens at least one Attention Item
  - `handoffTask` without an active Claim fails
  - resolving an already closed Attention Item fails
- Tests must read as executable domain examples

_Depends on T4a._

---

### Phase 5 — Application Foundation

All three tasks may proceed in parallel with Phase 3 (they depend only on Phase 2 and T0, not on transitions). All three block Phase 6.

**T5a · Application errors** — `packages/application/src/errors.ts`

- `Data.TaggedError` classes: `RepositoryUnavailable`, `RepositoryConflict`, `TrackerProjectionFailed`, `ClaimMarkerFailed`, `MemoryRecordWriteFailed`, `EligibilityRuleViolated`
- `ApplicationError` union alias

_Depends on T0, T2b._

**T5b · Application ports** — `packages/application/src/ports/`

- `TaskLifecycleRepository` as a `Context.Tag` service class: `load` and `save` operations; `save` must reject state with non-empty pending fields
- `IdGenerator` as a `Context.Tag` service class
- `TrackerProjectionPort` as a `Context.Tag` service class
- `ClaimMarkerPort` as a `Context.Tag` service class
- `MemoryRecordPort` as a `Context.Tag` service class

_Depends on T2a, T2c._

**T5c · `WallClock` Layer** — `packages/application/src/ports/clock.ts`

- `Layer.effect` backed by Effect's built-in `Clock` service that satisfies the `WallClock` tag from `@talby/workforce-domain`

_Depends on T1b._

---

### Phase 6 — Application Use Cases

Three parallel groups. Each depends on its matching Phase 3 group plus all of Phase 5. All three block Phase 7.

**T6A · Claim use cases** — `packages/application/src/use-cases/`

- `claim-task-for-workflow.ts` — evaluates Workspace Eligibility Rules; fails with `EligibilityRuleViolated` if not met; calls `checkClaimEligibility` then `claimTask`; assigns `ClaimId` via `IdGenerator`; drains `pendingActiveClaim`; persists; projects
- `renew-claim-lease.ts`
- `release-claim.ts`

_Depends on T3A, T5a, T5b, T5c._

**T6B · Workflow Run use cases** — `packages/application/src/use-cases/`

- `start-workflow-run.ts` — assigns `WorkflowRunId` via `IdGenerator`; drains `pendingActiveWorkflowRun`
- `complete-workflow-run.ts`
- `fail-workflow-run.ts` — assigns `AttentionItemId`(s) via `IdGenerator`; drains `pendingAttentionItems`

_Depends on T3B, T5a, T5b. Parallel with T6A._

**T6C · Attention and Handoff use cases** — `packages/application/src/use-cases/`

- `handoff-task.ts`
- `open-attention-item.ts` — assigns `AttentionItemId` via `IdGenerator`; drains `pendingAttentionItems`
- `resolve-attention-item.ts`

_Depends on T3C, T5a, T5b. Parallel with T6A, T6B._

---

### Phase 7 — Application Package Completion

**T7a · Application `index.ts`** — `packages/application/src/index.ts`

- Re-export all public use cases, port tags, and errors

_Depends on T6A, T6B, T6C._

**T7b · Application tests** — `packages/application/src/__tests__/`

- Port fakes via `Layer.succeed`
- Verify load → transition → enrich → persist → project ordering for each use case
- Verify no outbound projection occurs when the domain rejects a transition
- Verify outbound projection failures are reported distinctly from domain failures
- Verify the correct `DomainFact` values are routed to the correct projection ports

_Depends on T7a._

---

### Dependency Graph

```text
T0
├─ T1a ──┐
├─ T1b ──┼──► T2a ──┐
└─ T1c ──┘    T2b ──┼──► T3A ──┐                ► T4a ──► T4b
              T2c ──┘    T3B ──┼──► T3A,T3B,T3C ─┘
                          T3C ──┘
              T2a,T2c ──► T5b ──┐
              T2b ──────► T5a ──┼──► T6A (+ T3A) ──┐
              T1b ────────T5c ──┘    T6B (+ T3B) ──┼──► T7a ──► T7b
                                     T6C (+ T3C) ──┘
```

---

## Open Decisions Intentionally Deferred

The following are explicitly deferred to later specs:

- repository persistence schema and concurrency mechanism
- event storage and replay strategy
- detailed Conversation submodel beyond lifecycle references
- tracker adapter protocol details
- memory ingestion payload format
- workflow engine integration details
- the concrete schema for workflow-level and step-level `Agent` and `Skill` declarations
- the transport or file format used to represent directly invocable `Skill` selection and step-level ad hoc text

Deferring these keeps the first slice small enough to implement without losing the essential lifecycle rules.
