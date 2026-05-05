# Core Domain Model Design

## Status

- Date: 2026-05-05
- Scope: Core domain and workflow lifecycle first slice
- Target package: `@talby/core`
- Chosen style: Functional domain with explicit use-case modules

## Goal

Define the first implementation slice of Talby Workforce around the core workflow lifecycle so later packages can depend on one authoritative model for claim, handoff, workflow run, and attention behavior without re-deciding domain rules in adapters or handlers.

This slice covers domain types and application-service ports. It does not define persistence schemas, external adapter implementations, transport APIs, or full event sourcing.

## Why This Slice First

The current repository has a strong domain language in [CONTEXT.md](../../CONTEXT.md) but no implementation in [packages/core/src/index.ts](../../packages/core/src/index.ts). The first useful boundary is therefore the core lifecycle model that governs how a Task moves through claim and execution state.

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

## Design Principles

1. Domain rules live in core.
2. Domain transitions are pure functions over immutable state.
3. Application use cases orchestrate ports but do not redefine rules.
4. Infrastructure concerns stay outside `@talby/core`.
5. Errors use domain language, not generic strings.
6. Tests should read like executable domain examples.

## Architecture

The first slice should define one core package, `@talby/core`, with two internal layers: `domain` and `application`.

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

The domain layer returns updated state plus domain facts. It does not talk to repositories, the clock, or any external systems.

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

## Module Boundaries

`@talby/core` should be organized around domain concepts and use-case seams rather than transport or database boundaries.

Proposed package shape:

```text
packages/core/src/
  domain/
    ids/
    values/
    lifecycle/
      state.ts
      errors.ts
      facts.ts
      transitions/
        claim-task.ts
        renew-lease.ts
        release-claim.ts
        start-workflow-run.ts
        complete-workflow-run.ts
        fail-workflow-run.ts
        handoff-task.ts
        attention-item.ts
  application/
    ports/
      task-lifecycle-repository.ts
      clock.ts
      id-generator.ts
      tracker-projection-port.ts
      claim-marker-port.ts
      memory-record-port.ts
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

This keeps domain transitions local and predictable while giving the application layer explicit seams for orchestration.

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

This bundle is a domain convenience boundary, not a database record design. Its purpose is to ensure lifecycle functions receive the full local context required to enforce invariants.

### Supporting Types

The following supporting types should be explicit and narrow:

- branded identifiers for core entities
- fixed vocabularies for `ClaimOutcome` and `WorkflowRunOutcome`
- explicit lease timestamps and renewal windows
- explicit attention status values
- explicit stage and workspace references

The current fixed vocabularies from [CONTEXT.md](../../CONTEXT.md) should be preserved as authoritative inputs to the model.

## Domain API Shape

The domain API should be organized around transitions, not CRUD.

Each transition function should accept:

- current `TaskLifecycleState`
- a typed intent object containing only the data needed for the transition

Each transition function should return one of:

- `DomainError`
- success with `nextState` and `facts`

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

These facts give the application layer a structured basis for persistence follow-up and outbound projections without coupling the domain to transport or storage.

## Application Ports

The application layer should depend on explicit ports. Initial ports:

- `TaskLifecycleRepository`
- `Clock`
- `IdGenerator`
- `TrackerProjectionPort`
- `ClaimMarkerPort`
- `MemoryRecordPort`

### TaskLifecycleRepository

Loads and saves `TaskLifecycleState`. It may later support optimistic concurrency, but that policy should not be embedded into the domain layer.

### Clock

Provides the current time for lease creation, lease renewal, and timeout-sensitive validation.

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
3. persist accepted new state
4. project resulting facts through outbound ports

This ordering matters.

- domain code decides whether a transition is legal
- persistence stores the accepted new state
- outbound ports publish consequences to external systems

External systems never decide whether a Claim is legal or whether a Workflow Run may end. They only receive the consequences after the domain accepts the change.

## Example Flows

### Claim Task For Workflow

1. load `TaskLifecycleState`
2. validate eligibility and absence of active Claim
3. create Claim and Lease in domain code
4. persist new state
5. emit tracker and memory projections as needed

### Handoff Task

1. load `TaskLifecycleState`
2. verify that an active Claim exists
3. validate handoff intent against current lifecycle constraints
4. release Claim with outcome `handed_off`
5. end or pause active Workflow Run according to application policy
6. persist new state
7. project handoff consequences outward

### Fail Workflow Run

1. load `TaskLifecycleState`
2. verify active Workflow Run exists
3. fail Workflow Run in domain code
4. release Claim
5. open at least one Attention Item
6. persist new state
7. project outward to tracker and memory channels

This directly matches the v1 invariant that a failed Workflow Run releases its Claim and requires human attention.

## Error Model

The core slice should use typed domain errors, not string failures.

Example domain errors:

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

Domain errors represent violated lifecycle rules.

Application code may introduce a second error layer for operational failures, for example:

- repository conflict
- repository unavailable
- tracker projection failed
- memory record write failed

These must remain distinct from domain errors. A failed tracker projection does not mean the lifecycle rule was invalid. It means the domain transition succeeded and an external side effect failed afterward.

The first slice should therefore support the outcome shape: domain accepted, persistence committed, outbound projection failed.

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

- another package can depend on `@talby/core` for lifecycle decisions
- adapters do not need to re-implement claim and workflow rules
- typed domain errors and facts are sufficient for orchestrating side effects
- tests capture the key invariants from [CONTEXT.md](../../CONTEXT.md)
- the package boundary is still narrow enough to extend later with persistence and adapters without breaking the domain shape

This slice fails if lifecycle rules are still duplicated in handlers, adapters, or UI-oriented services.

## Open Decisions Intentionally Deferred

The following are explicitly deferred to later specs:

- repository persistence schema and concurrency mechanism
- event storage and replay strategy
- detailed Conversation submodel beyond lifecycle references
- tracker adapter protocol details
- memory ingestion payload format
- workflow engine integration details

Deferring these keeps the first slice small enough to implement without losing the essential lifecycle rules.
