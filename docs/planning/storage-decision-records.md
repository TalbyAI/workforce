# Storage Decision Records

Decisions made during the storage specification design session (2026-05-10).

## Decisions

### D01 — Hybrid storage model

Store both a state snapshot (for fast reads) and an appended fact log (for auditability). Load reads the snapshot; save upserts the snapshot and appends facts in one transaction.

### D02 — Single port owns the transaction boundary

`TaskLifecycleRepository` handles both snapshot upsert and fact append atomically. No split ports. The existing `save(state, facts)` shape fits naturally.

### D03 — No fact query method yet

Facts are append-only. No read API on the port until real access patterns emerge (by task? time range? fact type?). Defer to avoid premature API design.

### D04 — Package structure

- `@talby/workforce-infrastructure` — built-in adapters: in-memory Map stub, SQLite (in-memory and file). Ships with core.
- Separate packages per production backend: `@talby/workforce-postgresql`, `@talby/workforce-temporal`, `@talby/workforce-mastra`, etc. Each with isolated dependencies.

### D05 — SQLite driver: @effect/sql

Use `@effect/sql` with `@effect/sql-sqlite-node`. Same `@effect/sql` abstractions reused by `@talby/workforce-postgresql` via `@effect/sql-pg`. Idiomatic Effect composition.

### D06 — Schema management per backend

Each backend owns its schema strategy:

- SQLite in-memory: one-shot `CREATE TABLE` at layer init.
- SQLite on file: migration-based (schema evolves across restarts).
- PostgreSQL: migration-based (long-lived shared DB).

### D07 — Optimistic concurrency via version number

`UPDATE ... WHERE version = N`, write N+1. Zero rows affected = `RepositoryConflict`. Database-agnostic, no clock dependency.

### D08 — Versioned\<T\> wrapper at port boundary

Domain type `TaskLifecycleState` stays pure. Version flows through a generic wrapper:

```typescript
type Versioned<T> = {
  readonly state: T;
  readonly version: number;
};
```

Lives in the `application` package. Port signatures use `Versioned<TaskLifecycleState>`.

### D09 — In-memory adapter strategy

- Pure `Map`-based stub for unit tests (fast, no native deps, validates use-case logic).
- SQLite `:memory:` for integration tests (validates adapter SQL, serialization, conflict detection).

### D10 — Hybrid column serialization

Key queryable fields as discrete SQL columns (`task_id`, `workspace_id`, `stage`, `execution_status`, `version`). Remaining nested state as a JSON blob column.

### D11 — Effect Schema for JSON encoding

Use Effect `Schema` in the infrastructure package for JSON serialization/deserialization. Gives runtime decode validation (`ParseError` on corrupt/stale data). Built-in codecs for `Option`, `DateTime.Utc`, branded types.

### D12 — Explicit create method on port

- `create(state, facts)` — INSERT semantics, fails on conflict (`RepositoryConflict`). Symmetric with `save`.
- `load(taskId)` — returns `Option<Versioned<TaskLifecycleState>>`.
- `save(versioned, facts)` — UPDATE with version check.

### D13 — Accept current side-effect boundary, defer outbox

`save` commits to DB. Side-effect ports (tracker projection, claim marker, memory record) are called after save. If a side-effect fails, the DB write stands. Outbox pattern deferred until real failure modes are observed.

### D14 — Adapter depends on SqlClient

Adapter declares `SqlClient` as an Effect layer dependency. Consumer creates and provides the `SqlClient` layer. Multiple adapters share one connection.

### D15 — Schema init in adapter Layer.effect

Each adapter runs `CREATE TABLE IF NOT EXISTS` during its own `Layer.effect` construction. Self-contained, idempotent. No shared setup step.

### D16 — create and save return void

No returning updated `Versioned` from `save` or `create`. Current pattern is reload-per-use-case. Avoids adapter-side reconstruction of full domain objects after write.

### D17 — FactEnvelope\<T\> for fact metadata

Application layer wraps each `DomainFact` in a `FactEnvelope<T>` before passing to `save`/`create`:

```typescript
type FactEnvelope<T> = {
  readonly fact: T;
  readonly occurredAt: DateTime.Utc;
  readonly version: number;
  readonly sequence: number;
};
```

Timestamps from `WallClock` (consistent with domain time, overridable in tests). Lives in the `application` package.

### D18 — Unified fact store with entity_type + entity_id

Single `fact_log` table for all entity types. Application-level fact identity is carried as `(version, sequence)` inside `FactEnvelope`, while persisted rows also record stream and global ordering fields. This keeps the application contract stable while allowing the store to materialize richer ordering metadata. Extensible to new aggregates without new tables.

### D19 — Envelope omits entity fields, adapter infers

`FactEnvelope` does not carry `entityType`/`entityId`. The adapter knows its entity type (e.g., `"TaskLifecycle"`) and extracts the entity ID from the `Versioned` state. Avoids redundancy and consistency risk.

### D20 — Missing state is absence, not repository failure

Missing `TaskLifecycleState` is not an infrastructure outage. The repository `load` method returns `Option.none()` when no snapshot exists. Application use cases that require existing state map that absence to a dedicated `TaskLifecycleNotFound` error. `RepositoryUnavailable` remains reserved for actual repository failures.

### D21 — Fact envelope version matches written snapshot version

`FactEnvelope.version` stores the resulting per-stream version produced by the write, not the version that was loaded before it. Example: append to a Task stream loaded at version `7`, produce two new facts, and persist them under resulting stream version `8` for that write.

### D22 — Fact sequence starts at zero per persisted version

`FactEnvelope.sequence` starts at `0`, increments by `1`, and resets for each appended batch. It is an in-batch ordering field owned by the application contract, not the global persisted stream position.

### D23 — Application owns fact envelope creation

The application layer creates `FactEnvelope` values before calling the repository. A shared application helper stamps `occurredAt`, `version`, and `sequence`. The repository persists those envelope fields and derives persisted ordering metadata such as `fact_sequence`, `commit_sequence`, and `global_sequence` from the stream append operation.

### D24 — Create requires an initial ingestion fact

`TaskLifecycleRepository.create` must persist at least one fact. Snapshot-only bootstrap is not allowed. The ingestion fact type must be defined now so `create` always records an auditable first fact.

The same invariant applies to fact-store `append`: aggregate snapshots may accompany a fact commit, but they do not justify a zero-fact append on their own.

### D25 — Initial lifecycle fact is `TaskIngested`

The first persisted lifecycle fact is `TaskIngested`. This fact means Talby has accepted the Task into its own lifecycle and persistence boundary. It does not describe the external tracker's internal import mechanics.

### D26 — `TaskIngested` carries intake identity and initial routing state

`TaskIngested` carries `taskId`, `workspaceId`, `sourceReference`, `conversationId`, and initial `stage`. It does not carry `repositoryTargets`; those remain snapshot state unless a later audit need proves they belong in the fact log.

### D27 — First persisted version is `1`

`create` writes the first snapshot at version `1`. Its `TaskIngested` fact envelopes also use version `1`. Version `0` is never persisted.

### D28 — `entity_type` uses a one-member string literal union for now

Define `entity_type` as a string literal union with one member now and expand it when a second persisted aggregate appears. This gives typo protection immediately without branded-type ceremony.

### D29 — Persisted backends use numbered SQL files with history tracked in a table

SQLite on-file and PostgreSQL use raw numbered SQL migration files executed by a small custom runner built on `SqlClient`. Persisted backends record applied migrations in a database table. SQLite `:memory:` keeps one-shot schema init and does not use migration history.

### D30 — Persistence contracts live in a public application `persistence` module

`Versioned`, `FactEnvelope`, `TaskLifecycleNotFound`, and the fact-envelope builder live in a dedicated public `persistence` module in `@talby/workforce-application`. They are not use-case-local helpers and do not belong under `ports`.

### D31 — Intake metadata is snapshot-first

New intake-only metadata goes into snapshot state by default. Add a field to `TaskIngested` only when it is immutable at ingestion time and materially useful for audit or debugging without loading snapshot state.

### D32 — PostgreSQL preserves the same logical schema contract

`@talby/workforce-postgresql` keeps the same logical snapshot and fact-log contract as SQLite: same queryable fields, same version semantics, and same fact-log keys. PostgreSQL may use native JSON operators and backend-specific indexes internally, but not different column semantics.

### D33 — Additional aggregates start concrete, not generic

When a second persisted aggregate appears, it gets its own port and adapter first. Shared persistence scaffolding is extracted only after real duplication appears, and stays below the aggregate-specific port boundary.

### D34 — Facts become Talby's internal write-model source of truth

This decision supersedes D01 and D02. Persisted facts are now Talby's authoritative internal write model after Task Intake. This does not change the External Tracker as the canonical owner of Task lifecycle. Facts may still produce two different derived artifacts: transactional aggregate snapshots for command-side rebuilds, and asynchronous read models for query and operator-facing read concerns. Neither artifact is authoritative.

### D35 — Fact and snapshot storage split into separate ports

This decision supersedes D03 and D12. Talby uses a dedicated fact store port for fact append, fact reads, and persistent fact subscriptions. Aggregate snapshot access and asynchronous read-model access remain separate logical concerns even when one adapter stores fact rows, aggregate snapshot rows, and read-model rows in the same physical database.

### Terminology note after D34

- Aggregate snapshot — a transactional command-side checkpoint derived from facts and used only to rebuild aggregate state efficiently
- Read model — an asynchronous eventual-consistency internal representation derived from facts for query and operator-facing read concerns. In the Talby domain language, operator-facing read concerns surface as **Read Views** and **Current Task Views**, while **Tracker Projection** remains reserved for outbound updates written back to the External Tracker.

Unless a decision explicitly says `aggregate snapshot`, read-model concerns use `read model`, `Read View`, or `Current Task View` as appropriate. This keeps command-side checkpoints distinct from eventual-consistency internal reads and from **Tracker Projections**.

### D36 — Read models are updated asynchronously from persistent fact subscriptions

This decision supersedes D13. After facts are committed, read-model updaters may consume them through a durable subscription model and update internal read models after the fact. Read-model lag is accepted where async updates are used.

### D37 — Fact append concurrency is per-Task stream version

Each `TaskId` owns its own fact stream. Appends use an expected version scoped to that Task stream rather than a global write-order lock.

### D38 — Fact store has at least fact log, entity, and subscription tables

The fact repository has at least three persisted tables:

- `fact_log` — append-only facts with fields such as `entity_type`, `entity_id`, `fact_type`, `timestamp`, `payload`, `fact_sequence`, `commit_sequence`, and `global_sequence`
- `entity` — current per-entity stream head and related metadata, keyed by `entity_type` and `entity_id`
- `subscription` — durable subscriber state for persistent fact consumption

This keeps domain language aligned on "facts" even if some physical storage names or implementation details later use fact-store terminology internally.

### D39 — Fact log has both per-entity and global ordering fields

`fact_log` uses three ordering fields with distinct roles:

- `fact_sequence` — per-entity logical fact order within one fact stream
- `commit_sequence` — per-entity persisted commit order for the appended batch
- `global_sequence` — global auto-increment position used for durable subscription pointers and replay

Mapping back to the application contract:

- `FactEnvelope.version` — resulting stream version for the append
- `FactEnvelope.sequence` — zero-based ordinal within the appended batch
- `fact_sequence` — persisted per-fact stream position derived during append
- `commit_sequence` — persisted batch position for the stream append
- `global_sequence` — persisted global replay position across all streams

### D40 — Subscriptions are created with optional filters and an explicit start position

When a subscription is created, it may declare optional filters such as `entity_type` and `fact_type`. It also declares where consumption starts: by `global_sequence`, by timestamp, or from the beginning.

### D41 — Subscription delivery is at-least-once

Fact subscriptions deliver at least once. Redelivery is expected, so read-model updaters and other subscribers must be idempotent.

### D42 — Subscription checkpoints advance only after successful downstream persistence

The subscription checkpoint advances only after the handled batch has been persisted successfully by the downstream consumer. A checkpoint therefore means the batch is safe to skip on replay. Subscribers acknowledge progress explicitly after downstream persistence succeeds; the fact store does not advance checkpoints implicitly on delivery.

### D43 — Fact storage also keeps aggregate snapshot rows

The fact repository may also store aggregate snapshots in a `snapshots` table with fields such as `entity_type`, `entity_id`, `fact_sequence`, `commit_sequence`, `global_sequence`, `snapshot_version`, and `payload`. This does not collapse the logical port boundary from D35; it only means one physical adapter may own both storage concerns.

### D44 — `create` and `append` may save an optional aggregate snapshot checkpoint transactionally

Fact-store `create` and `append` operations may include an optional aggregate snapshot save in the same transaction as the fact commit. Whether an aggregate snapshot checkpoint is written is policy-driven per entity or command, for example every X commits, every X time window, or another caller-selected criterion. This is still a fact-bearing write path, not a snapshot-only write path.

### D45 — Aggregate snapshots are versioned and old versions may be garbage-collected

Aggregate snapshots carry a `snapshot_version` so rebuild logic can ignore stale checkpoint formats and rebuild from facts when aggregate reconstruction logic evolves. Old snapshots may be garbage-collected.

### D46 — Aggregate snapshots are transactional command-side checkpoints

Aggregate snapshots are saved transactionally with fact commits and contain the state needed for business decisions during command handling.

### D47 — Read models are separate eventual-consistency internal views

Read models are derived from past facts asynchronously and serve internal read concerns such as filtering, pagination, sorting, query shaping, **Read Views**, and **Current Task Views**. They may resemble aggregate snapshots, but do not need to share the same shape or semantics.

### D48 — Command handlers never depend on read models

Command handlers may use transactional aggregate snapshots as checkpoints, but they must never depend on read models or any other eventually consistent state for business decisions.

### D49 — Rebuild does not force an immediate snapshot write

When a command handler rebuilds aggregate state because no usable snapshot exists, it may continue in memory without forcing a fresh snapshot write first. Snapshot persistence still follows normal checkpoint policy.

### D50 — Rebuild starts from the latest compatible aggregate snapshot

Command-side rebuild starts from the latest compatible aggregate snapshot and replays only trailing facts after its stored position. If no compatible snapshot exists, rebuild falls back to full replay from the beginning.

### D51 — Command-side rebuild uses one composite fact-store read

The fact store exposes one composite command-side read that returns the latest compatible aggregate snapshot plus trailing facts. Compatibility checks and trailing-fact boundaries stay inside the storage abstraction rather than being recomposed by application code.

### D52 — Default fact reads are aggregate-stream reads

The default fact read API returns facts for one aggregate stream identified by `entity_type` and `entity_id`. Broader filtered cross-stream queries are added later only when a concrete audit, debugging, or operational consumer needs them.

### D53 — Authoritative facts are never destructively deleted

Talby does not destructively delete authoritative facts from `fact_log`. Facts may be archived out of the hot store, but replay must remain possible across retained plus archived history.

### D54 — Fact-store reads span hot and archived facts transparently

The fact-store abstraction hides the boundary between hot and archived facts. Replay and stream reads request facts by stream or range, and the repository resolves them across both storage tiers as needed.

## Superseded decisions

- D01 — superseded by D34
- D02 — superseded by D34
- D03 — superseded by D35
- D12 — superseded by D35
- D13 — superseded by D36

## Updated port shape (summary)

```typescript
type NonEmptyFacts<T> = readonly [FactEnvelope<T>, ...FactEnvelope<T>[]];

type TaskLifecycleCommandLoad = {
  readonly aggregateSnapshot: unknown | null;
  readonly trailingFacts: ReadonlyArray<FactEnvelope<DomainFact>>;
};

interface TaskLifecycleFactStoreService {
  readonly create: (args: {
    taskId: TaskId;
    facts: NonEmptyFacts<DomainFact>;
    aggregateSnapshot?: unknown;
  }) => Effect<void, RepositoryConflict | RepositoryUnavailable>;

  readonly append: (
    args: {
      taskId: TaskId;
      expectedVersion: number | null;
      facts: NonEmptyFacts<DomainFact>;
      aggregateSnapshot?: unknown;
    }
  ) => Effect<void, RepositoryConflict | RepositoryUnavailable>;

  readonly readStream: (
    taskId: TaskId
  ) => Effect<ReadonlyArray<FactEnvelope<DomainFact>>, RepositoryUnavailable>;

  readonly loadForCommand: (
    taskId: TaskId
  ) => Effect<TaskLifecycleCommandLoad, RepositoryUnavailable>;

  readonly createSubscription: (args: {
    subscriberId: string;
    filters?: {
      entityType?: string;
      factType?: string;
    };
    startFrom:
      | { type: "global-sequence"; value: number }
      | { type: "timestamp"; value: DateTime.Utc }
      | { type: "beginning" };
  }) => Effect<void, RepositoryUnavailable>;

  readonly subscribe: (
    subscriberId: string
  ) => Stream.Stream<ReadonlyArray<FactEnvelope<DomainFact>>, RepositoryUnavailable>;

  readonly acknowledge: (args: {
    subscriberId: string;
    throughGlobalSequence: number;
  }) => Effect<void, RepositoryUnavailable>;
}

interface TaskLifecycleReadModelRepositoryService {
  readonly load: (query: unknown) => Effect<unknown, RepositoryUnavailable>;

  readonly saveReadModel: (
    readModel: unknown
  ) => Effect<void, RepositoryConflict | RepositoryUnavailable>;
}
```

## Current model after D54

- Facts are the authoritative write model
- Aggregate snapshots are optional transactional command-side checkpoints used to speed up rebuilds
- Read models are asynchronous internal views updated from durable subscriptions
- `FactEnvelope.version` and `FactEnvelope.sequence` are application-facing fields; `fact_sequence`, `commit_sequence`, and `global_sequence` are persisted ordering fields derived during append
- `create` and `append` are always fact-bearing writes; aggregate snapshots may accompany them but do not replace facts
- Command handlers read through `loadForCommand` and never depend on read models
- Subscribers process facts at least once and advance checkpoints only through explicit acknowledgment after downstream persistence succeeds

## Pending subjects
