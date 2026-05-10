---
title: Talby Workforce Platform BRD
description: Business requirements document for the Talby Workforce platform that coordinates external tasks, orchestrates agent work, and exposes progress to operators
author: GitHub Copilot
ms.date: 2026-05-09
ms.topic: overview
---

## Document Status

Draft 0.3. This version is derived from the repository's current domain model,
planning notes, raw idea capture, and follow-up business clarifications. It is
suitable for refinement and review, not final approval.

## Business Context and Background

Talby Workforce is intended to coordinate teams of agents that execute work
defined outside the system. The platform does not replace the canonical task
systems used by customers. Instead, it ingests Tasks from External Trackers,
routes them through Workspace policy, orchestrates agent execution through
Workflow Runs, and projects progress back to human Operators and external
systems.

For task-tracking integrations, Talby must isolate source-specific details at
the task manager boundary. The task manager port or adapter converts Azure
DevOps-specific fields, links, labels, and statuses into Talby's generic Task
representation. Configurable routers then use that Talby-generic Task data to
assign the appropriate Workflow without depending directly on Azure
DevOps-specific payload shapes.

The current repository already defines a strong domain model for core concepts
such as Task, Workspace, Claim, Lease, Workflow Run, Attention Item,
Conversation, Repository, and External Tracker. That model indicates an early
product direction centered on safe task claiming, human supervision, external
system interoperability, and auditable agent collaboration.

The current incubation sponsor is the author's employer, which is funding the
time spent on the initiative and the access to AI providers required to operate
the system. That makes the initial business framing an internally sponsored
platform investment rather than a purely speculative product concept.

## Problem Statement and Business Drivers

Organizations increasingly want agent-based execution for operational and
software work, but their work already lives in existing External Trackers,
repositories, and communication systems. Without a coordinating layer:

* Work ownership becomes ambiguous when multiple agents or humans can act on the
  same Task
* Operational visibility is fragmented across trackers, chats, repositories,
  and workflow tools
* Human intervention lacks a single supervised path when automated work stalls,
  fails, or requires approval
* Integrations are bespoke, which increases onboarding time for each new tool
  and workspace
* The business cannot measure whether agent execution is improving throughput,
  reliability, or operator efficiency

The primary business drivers are:

* Reduce manual coordination overhead for teams supervising agent work
* Enable safe multi-agent execution against externally managed work
* Preserve external system ownership while adding Talby-managed execution
  control and visibility
* Create a reusable platform that can support multiple trackers, repositories,
  memory systems, and execution runtimes
* Provide a foundation for operator trust through auditable conversations,
  attention handling, and deterministic ownership rules

## Business Objectives and Success Metrics

### Objective BO-001

Provide a reliable operating model for agent execution on externally managed
Tasks.

Success metrics:

* At least 95% of eligible Tasks are processed without duplicate active Claims
* 100% of active Claims have a visible Lease state and outcome trail
* Fewer than 2% of Workflow Runs end in an unresolved ownership conflict

### Objective BO-002

Reduce operator effort required to supervise and unblock agent work.

Success metrics:

* Reduce average operator triage time for an Attention Item by 40% from the
  agreed baseline
* Reduce time to identify task status, conversation context, and next action to
  under 2 minutes for 90% of reviewed items

### Objective BO-003

Support workspace-specific policy and integration variability without changing
the core operating model.

Success metrics:

* Support at least 3 External Tracker integrations under one consistent Task and
  Stage model
* Support at least 2 repository roles, read-only Repository Targets and one
  Write Repository, within the same Task flow

### Objective BO-004

Make execution progress and intervention points visible to humans and connected
systems.

Success metrics:

* 100% of failed Workflow Runs generate an Attention Item or equivalent operator
  signal
* 90% of pilot users report they can determine current Task state without
  opening multiple external tools

> [!NOTE]
> Baselines, pilot cohort size, and target timeframes still need business-owner
> confirmation.

## Stakeholders and Roles

| Stakeholder | Role in the business process | Primary need |
| --- | --- | --- |
| Product sponsor | The current employer funds the initiative and owns the initial investment case | Faster, safer agent execution with measurable value |
| Operator | Supervises work in progress and handles intervention | Clear Attention Queue, task context, and action paths |
| Workspace administrator | Configures policy boundaries and integration behavior | Predictable Workspace rules and low-friction setup |
| Integration owner | Connects External Trackers, repositories, memory, and runtime systems | Stable abstractions and operational diagnostics |
| Compliance or audit stakeholder | Reviews traceability and control evidence | Durable record of claims, handoffs, outcomes, and interventions |
| Agent or workflow designer | Defines how work is automated | Reliable execution semantics and reusable orchestration primitives |

## Scope

### In Scope

* Ingesting and representing externally managed Tasks inside Talby
* Normalizing source-specific task manager data into Talby-generic Task data
* Workspace-level policy boundaries, including Stage Vocabulary and Eligibility
  Rules
* Configurable routing that assigns Workflows from Talby-generic Task data
* Claim and Lease control to ensure exclusive task ownership by one active
  Workflow Run at a time
* Workflow Run lifecycle handling including start, completion, failure, release,
  renewal, and handoff
* Operator-facing attention and task supervision concepts
* Conversation and memory capture sufficient to support task-level collaboration
  and traceability
* Repository participation for read access across Repository Targets and one
  primary Write Repository in v1
* Tracker Projection back to the External Tracker for relevant task updates
* Extensible integration model for trackers, memory systems, execution systems,
  repositories, tools, prompts, agents, and skills

### Out of Scope for This BRD

* Full UI interaction design and visual specification
* Low-level infrastructure choices for runtime hosting
* Vendor-specific implementation details for memory or workflow engines
* Pricing model, packaging strategy, or commercial go-to-market details
* A native Talby task management system that replaces External Trackers in v1

### Initial Release Focus

The first delivery focus for Talby Workforce is a workflow centered on pull
request and branch review. In that flow, Talby ingests work from Azure DevOps,
coordinates review-oriented Workflow Runs, surfaces Attention Items for blocked
or ambiguous work, and helps Operators unstuck those workflows.

For the first intake rule, Talby ingests an Azure DevOps Work Item only when it
matches a configurable eligibility policy and it already has a linked pull
request ready for review. The configurable policy may use `System.Tags`, one or
more custom fields, status, or a combination of those signals.

The Azure DevOps adapter is responsible for turning those source-specific
signals into Talby-generic Task data. Routing decisions must be made by
configurable routers against the normalized Task representation so the system
can support multiple rule examples and future tracker integrations without
rewriting workflow assignment logic.

Initial release priorities are:

* Azure DevOps as the first External Tracker integration
* PR and branch review as the pilot workflow used to prove value
* Operator workflows focused on reading Attention Items and unblocking stalled
  execution
* Reusable domain abstractions that still allow later expansion to additional
  trackers and workflow types

## Current and Future Business Processes

### Current-State Business Process

The current business need assumes that work originates in an External Tracker,
that humans or agents need to act on it, and that status, conversation, and
repository work are split across multiple tools. Ownership, escalation, and
execution history are hard to understand in one place.

### Future-State Business Process

1. A Work Item is read from an External Tracker by the task manager adapter.
2. The adapter converts tracker-specific fields, states, tags, and links into
  Talby's generic Task representation.
3. Talby evaluates configurable Eligibility Rules and routes the Task using
  Workspace policy and the normalized Task data. In the first Azure DevOps
  flow, the Work Item must satisfy a configurable eligibility rule and
  reference a linked pull request that is ready for review.
4. Talby selects Repository Targets and, when needed, one Write Repository and
   Change Branch strategy.
5. Talby acquires a Claim and starts one Workflow Run.
6. The Workflow Run invokes Agents, Skills, Prompts, repositories, and other
  integrations to perform work, with the initial pilot centered on PR and
  branch review.
7. Talby records Conversation activity and Memory Records associated with the
   Task.
8. If automated work requires human action, Talby creates an Attention Item and
   exposes it through the Attention Queue.
9. The Operator reviews the Task-centric detail view, reads the Attention Item,
  and either unblocks, resolves, or hands off work.
10. Talby writes Tracker Projections and other business-relevant updates back to
   the External Tracker.
11. The Workflow Run ends with a defined Workflow Run Outcome and the Claim ends
   with a defined Claim Outcome.

## Business Requirements

### BR-001 Task Ingestion and Canonical Mapping

Talby must ingest a Task from exactly one External Tracker and retain a stable
Source Reference to the originating external record.

Acceptance criteria:

* Every Task created in Talby is linked to one External Tracker source
* Every Task has exactly one Talby Task ID
* The source mapping can be used for outbound Tracker Projection and audit
* The task manager adapter converts Azure DevOps-specific task data into a
  Talby-generic Task representation before routing or workflow assignment
* In the first Azure DevOps flow, Talby only ingests a Work Item when the
  configured Azure DevOps eligibility signals and linked pull request
  conditions are satisfied

Linked objectives: BO-001, BO-003

Impacted stakeholders: Product sponsor, integration owner, operator

Priority: Must

### BR-002 Workspace Policy Boundary

Talby must manage Tasks within a Workspace that defines Stage Vocabulary,
Eligibility Rules, and governed integrations.

Acceptance criteria:

* A Task is associated with exactly one Workspace
* Workspace policy determines task eligibility before execution begins
* Stage handling is validated against the active Stage Vocabulary for that
  Workspace
* The initial Azure DevOps Eligibility Rule is configurable per Workspace and
  can use `System.Tags`, custom fields, status, or a combination of those
  signals
* The initial Azure DevOps Eligibility Rule still requires a linked pull
  request that is ready for review before ingestion begins
* Workflow assignment is made from normalized Talby Task data, not by coupling
  routers directly to Azure DevOps-specific payload fields

Linked objectives: BO-001, BO-003

Impacted stakeholders: Workspace administrator, integration owner

Priority: Must

### BR-003 Exclusive Task Ownership

Talby must prevent multiple active Workflow Runs from owning the same Task at
the same time.

Acceptance criteria:

* A Task can have at most one active Claim at a time
* Only a Workflow Run can hold a Claim
* Claim acquisition fails when an active Claim already exists

Linked objectives: BO-001

Impacted stakeholders: Operator, workflow designer, compliance stakeholder

Priority: Must

### BR-004 Lease Visibility and Renewal

Talby must manage a Lease for each active Claim and support bounded renewal to
retain ownership.

Acceptance criteria:

* Every active Claim has exactly one Lease
* Lease state is visible to the operating system users or downstream monitoring
* Lease renewal and expiry events are recorded for audit and operational review

Linked objectives: BO-001, BO-004

Impacted stakeholders: Operator, compliance stakeholder, integration owner

Priority: Must

### BR-005 Workflow Run Lifecycle Control

Talby must support starting, completing, failing, handing off, and releasing a
Workflow Run in a controlled manner.

Acceptance criteria:

* Every completed Workflow Run records one Workflow Run Outcome
* Every completed Claim records one Claim Outcome
* Handoff behavior releases the active Claim by default
* Failed runs create operator-visible attention signals

Linked objectives: BO-001, BO-004

Impacted stakeholders: Operator, workflow designer, product sponsor

Priority: Must

### BR-006 Attention Management for Human Intervention

Talby must provide a business-visible Attention Queue and Attention Items for
cases that require human review, acknowledgment, or action.

Acceptance criteria:

* A Workflow Run can create one or more Attention Items for a Task
* Operators can identify why attention is required and what Task is affected
* Operators can use the Attention Item context to unstuck a blocked Workflow Run
* Operators can resolve or reopen an Attention Item

Linked objectives: BO-002, BO-004

Impacted stakeholders: Operator, product sponsor

Priority: Must

### BR-007 Task-Centric Conversation and Memory Trace

Talby must retain a Conversation and associated Memory Records for active work
on each Task.

Acceptance criteria:

* Each active Task has one active Conversation while it is being processed
* Memory Records are append-only in v1
* Records retain enough participant and artifact context to support review and
  intervention

Linked objectives: BO-002, BO-004

Impacted stakeholders: Operator, compliance stakeholder, workflow designer

Priority: Must

### BR-008 Repository Coordination

Talby must support zero or more read Repository Targets and at most one primary
Write Repository for a Task in v1.

Acceptance criteria:

* A Task can reference multiple Repository Targets
* One Write Repository can be selected when delivery work requires repository
  changes
* The primary Pull Request remains associated with the Task across serial
  Workflow Runs unless policy says otherwise

Linked objectives: BO-003, BO-004

Impacted stakeholders: Integration owner, workflow designer, operator

Priority: Must

### BR-009 Tracker Projection

Talby must project relevant updates back to the External Tracker without taking
over canonical lifecycle ownership.

Acceptance criteria:

* Talby can emit Tracker Projections tied to the originating Source Reference
* The External Tracker remains the canonical task lifecycle owner
* Projection failures are detectable and recoverable through operational review
* The first release can project the minimum required updates to Azure DevOps
  work items for the PR and branch review workflow

Linked objectives: BO-003, BO-004

Impacted stakeholders: Product sponsor, integration owner, operator

Priority: Must

### BR-010 Operator Action Set

Talby must provide a minimal but sufficient Operator Action Set from the task
detail experience.

Acceptance criteria:

* Operators can read the Attention Item and its task context from the primary
  task view
* Operators can resolve or reopen an Attention Item
* Operators can trigger a Handoff to move responsibility forward
* Operators can access the related repository, branch, pull request, or tracker
  record needed to unstuck the workflow

Linked objectives: BO-002, BO-004

Impacted stakeholders: Operator

Priority: Must

### BR-013 PR and Branch Review Workflow Support

Talby must support an initial workflow specialized for PR and branch review so
that the business can validate the platform on a narrow, high-value use case.

Acceptance criteria:

* A Workflow Run can be started for a Task that requires PR or branch review
* The workflow can inspect relevant repository context and report findings or
  blockers back into the Task Conversation or Attention Item flow
* The workflow can distinguish between successful review completion, blocked
  review, and handoff-needed outcomes
* The workflow starts from an ingested Azure DevOps Work Item whose linked pull
  request is already ready for review

Linked objectives: BO-001, BO-002, BO-004

Impacted stakeholders: Product sponsor, operator, workflow designer

Priority: Must

### BR-014 Task Manager Normalization Boundary

Talby must use a task manager port or adapter that converts tracker-specific
task data into Talby's generic Task representation before routing and workflow
selection occur.

Acceptance criteria:

* The Azure DevOps adapter can read source-specific fields such as tags,
  statuses, custom fields, and pull-request links
* The adapter publishes Talby-generic Task data for downstream routing and
  execution decisions
* Workflow routers do not require direct knowledge of Azure DevOps field names
  or payload shapes

Linked objectives: BO-001, BO-003

Impacted stakeholders: Integration owner, workspace administrator, workflow
designer

Priority: Must

### BR-015 Configurable Workflow Routing

Talby must assign Workflows through configurable routers that evaluate
normalized Task data and support multiple rule examples without requiring a
single hard-coded routing rule upfront.

Acceptance criteria:

* Workspace administrators can configure routing rules against Talby-generic
  Task attributes
* Routing configuration can express multiple examples or patterns for deciding
  which Workflow should handle a Task
* The system does not require the business to finalize one universal routing
  rule before the first release

Linked objectives: BO-001, BO-003

Impacted stakeholders: Workspace administrator, integration owner, workflow
designer, product sponsor

Priority: Must

### BR-011 Integration Extensibility

Talby must expose a business-level abstraction that allows additional trackers,
memory systems, execution systems, repositories, and tools to be added without
rewriting the operating model.

Acceptance criteria:

* New integration types can map to the existing core business concepts
* Integration-specific details do not change the meaning of Task, Workspace,
  Claim, Workflow Run, or Attention Item
* Workspace policy can govern different combinations of integrations

Linked objectives: BO-003

Impacted stakeholders: Product sponsor, integration owner, workspace
administrator

Priority: Must

### BR-012 Auditability and Business Traceability

Talby must provide enough historical evidence to explain what happened to a
Task, who intervened, and what outcome was reached.

Acceptance criteria:

* Claim, Lease, Workflow Run, Attention Item, and Conversation history are
  reviewable
* Human interventions and handoffs are attributable
* Business users can reconstruct major task events without querying raw system
  logs

Linked objectives: BO-001, BO-004

Impacted stakeholders: Compliance stakeholder, operator, product sponsor

Priority: Must

## Example Intake and Routing Configurations

The following examples are illustrative. They are intended to show the kinds of
configurations the system must support, not to define one mandatory rule set.

### Example 1 Tag-Driven PR Review Intake

Intake signals:

* Azure DevOps `System.Tags` contains `agent`
* Work Item status is `Validate`
* A linked pull request is present and marked ready for review

Normalized Task data produced by the adapter:

* `task.kind = review_candidate`
* `task.reviewState = ready`
* `task.sourceSignals.tags = [agent]`
* `task.sourceSignals.status = Validate`

Routing result:

* Router assigns the `pr-review` Workflow

### Example 2 Custom-Field-Driven Review Intake

Intake signals:

* Custom field `Custom.AgentIntent` equals `pr-review`
* Work Item status is not terminal
* A linked pull request is present and marked ready for review

Normalized Task data produced by the adapter:

* `task.kind = review_candidate`
* `task.intent = pr-review`
* `task.reviewState = ready`

Routing result:

* Router assigns the `pr-review` Workflow without depending on the custom field
  name directly

### Example 3 Status-First Validation Lane

Intake signals:

* Work Item status is `Validate`
* Repository link exists
* A linked pull request is present and marked ready for review

Normalized Task data produced by the adapter:

* `task.stage = validate`
* `task.kind = review_candidate`
* `task.reviewState = ready`

Routing result:

* Router assigns the `pr-review` Workflow when the normalized stage and review
  state match the configured policy

### Example 4 Combined Signals with Fallback

Intake signals:

* Preferred signal: `System.Tags` contains `agent-review`
* Fallback signal: custom field `Custom.RouteTo` equals `review`
* Supporting signal: status is `Validate`
* A linked pull request is present and marked ready for review

Normalized Task data produced by the adapter:

* `task.kind = review_candidate`
* `task.intent = review`
* `task.stage = validate`
* `task.reviewState = ready`

Routing result:

* Router assigns the `pr-review` Workflow when either configured intent signal
  is present and the normalized review readiness check passes

### Example 5 Attention-Oriented Routing for Blocked Reviews

Intake signals:

* Work Item was previously routed to PR review
* Pull request is linked but no longer ready for review, or required review
  metadata is missing

Normalized Task data produced by the adapter:

* `task.kind = review_candidate`
* `task.reviewState = blocked`
* `task.blockReason = missing_review_readiness`

Routing result:

* Router assigns an `attention-triage` or `review-unblock` Workflow instead of
  the standard `pr-review` Workflow

## Data and Reporting Requirements

Talby should provide reporting views or exports for at least the following:

* Eligible Tasks versus ineligible Tasks by Workspace
* Active Claims and Lease status
* Workflow Run outcomes over time
* Attention Item volumes, aging, and resolution time
* Tracker Projection success or failure rates
* Repository activity associated with a Task, including Pull Request linkage

Open reporting questions:

* Which metrics must be visible in-product versus exported to external BI tools
* Which retention period applies to operational and audit records
* Which blocked-workflow indicators should be counted for the PR and branch
  review pilot

## Benefits and High-Level Economics

Expected benefits:

* Lower supervision cost for multi-agent work
* Faster task throughput through structured automation and controlled handoffs
* Reduced duplicate work through explicit Claim ownership
* Lower integration cost over time through reusable business abstractions
* Better operator trust through visible attention, conversation, and outcome
  trails

Economic assumptions that still require validation:

* Baseline operator effort per blocked workflow or Attention Item
* Cost of failed or duplicated automated work today
* Value of faster turnaround in PR and branch review use cases
* Cost to add each new integration under the proposed operating model

## Risks and Assumptions

Key assumptions:

* Customers will keep canonical task lifecycle ownership in their External
  Tracker
* A single active Claim model is acceptable for v1 even when a Task spawns
  Subtasks
* Operators prefer a task-centric workflow with Attention Queue entry points

Primary risks:

* External systems may not expose enough primitives to represent Claim Markers
  consistently
* Workspace policy may become too complex without governance conventions
* Operator trust may be weak if Attention Items are noisy or ambiguous
* Reporting targets may be hard to prove if baseline metrics are not captured
  early

## Open Questions

* What audit retention and compliance obligations apply
* What exact event or threshold should mark a PR or branch review workflow as
  blocked
* Which operator actions beyond reading Attention Items and unstucking workflows
  are needed in phase one

## Next Review Focus

The next refinement cycle should define example Azure DevOps intake and routing
configurations, blocked-workflow detection rules, and measurable baselines for
operator effort and review-flow reliability.
