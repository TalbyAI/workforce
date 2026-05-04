# Talby Workforce

Talby Workforce coordinates teams of agents that execute work defined outside the system. It exists to ingest work from external tools, orchestrate execution, and expose progress back to humans and systems.

## Language

**Task**:
A unit of work mirrored from an external tracker and processed by Talby.
_Avoid_: internal ticket, local task

**Task ID**:
The Talby-generated identifier that uniquely identifies a Task inside Talby.
_Avoid_: external issue id, tracker key

**Workspace**:
The Talby policy boundary that defines Stage Vocabulary, Eligibility Rules, and the external sources governed together.
_Avoid_: integration connection, single tracker board

**Participant**:
A human or Agent identity that contributes to or queries a Conversation.
_Avoid_: anonymous sender, worker session

**Operator**:
A human user who supervises Talby work, intervenes when needed, and manages task flow through the UI.
_Avoid_: end customer, passive observer

**Repository**:
A source repository that Talby may read from or write to while executing work.
_Avoid_: workspace, tracker source

**Repository Profile**:
A Talby-managed metadata description attached to a Repository that states its purpose, read or write role, and routing cues such as trigger phrases.
_Avoid_: ad hoc repo note, workflow run state

**Repository Binding**:
The Talby policy association that assigns a Repository to one Workspace by default.
_Avoid_: hard access control, exclusive Git permission

**Repository Target**:
The use of a Repository as part of the work required to complete a Task.
_Avoid_: separate task, workspace binding

**Pull Request**:
A proposed change for one write Repository that Talby uses as the primary git delivery unit for a Task.
_Avoid_: task, branch set, multi-repo bundle

**Write Repository**:
The single Repository where Talby opens the primary Pull Request for a Task in v1.
_Avoid_: read-only repository, workspace

**Change Branch**:
The writable branch or equivalent head that Talby uses to produce the primary Pull Request for a Task.
_Avoid_: repository profile, task id

**Conversation**:
A task-scoped collaborative thread of messages and memory updates involving humans and Agent Instances.
_Avoid_: feature-wide log, finished-only session

**Memory Thread**:
The canonical external memory-system thread that stores the records of one Conversation.
_Avoid_: secondary shard, parallel conversation thread

**External Tracker**:
A third-party work management system that owns the canonical task lifecycle for imported Tasks.
_Avoid_: Talby backlog, internal board

**Source Reference**:
The integration-managed mapping from a Task to its originating record in an External Tracker.
_Avoid_: primary task id, public task id

**Tracker Projection**:
An outbound update that Talby writes into the External Tracker to reflect work performed or state decided in Talby.
_Avoid_: mirrored field, shared ownership

**Eligibility Rule**:
A Talby configuration rule that determines whether a Task is eligible for Talby to start a Workflow Run.
_Avoid_: task configuration, implicit pickup rule

**Execution State**:
Talby-managed progress metadata about how agents are handling a Task.
_Avoid_: task status, tracker status

**Stage**:
The normalized external workflow position of a Task used for routing and handoff.
_Avoid_: execution state, internal runtime progress

**Stage Vocabulary**:
The Talby-configured set of valid Stages for a specific workspace or integration context.
_Avoid_: global workflow taxonomy, universal stages

**Claim Marker**:
The representation of an active Claim in the External Tracker, such as assignee, title prefix, label, or status.
_Avoid_: claim itself, internal lease state

**Attention Item**:
A user-facing signal that Talby requires human intervention or acknowledgment for a Task.
_Avoid_: low-level notification delivery, silent error

**Attention Queue**:
The operator's primary working list of open Attention Items that require review or action.
_Avoid_: passive dashboard, generic task list

**Operator Action Set**:
A minimal set of actions the Operator can perform from the v1 task view.
_Avoid_: full administration surface, generic edit menu

**Handoff**:
The act of projecting a Task into a new external stage so the next worker or human can take responsibility.
_Avoid_: silent status change, internal retry

**Claim Outcome**:
The reason a Claim ended.
_Avoid_: generic result, free-form status note

**Claim**:
Talby's exclusive right for a Workflow Run to work a Task for a bounded period.
_Avoid_: pickup, lock

**Lease**:
The time-bounded validity window of a Claim, which must be renewed to retain ownership.
_Avoid_: permanent assignment, reservation

**Worker**:
A Talby infrastructure runtime that hosts execution but does not own task responsibility in the domain model.
_Avoid_: claim owner, business actor

**Capability Profile**:
A reusable set of Skills and Tools that defines what an agent can do.
_Avoid_: single prompt, runtime instance

**Skill**:
An instruction folder that teaches Talby how to perform a specific kind of work.
_Avoid_: tool configuration, persona

**Tool**:
A configured integration, such as an MCP or CLI plus the guidance needed to use it.
_Avoid_: skill, persona

**Agent**:
A persona that has access to one or more Capability Profiles.
_Avoid_: runtime owner, skill bundle

**Prompt**:
A versioned directed command for an Agent with a narrower goal than simply invoking the Agent in general.
_Avoid_: persona, workflow run, ad hoc runtime instruction

**Agent Repository**:
A dedicated repository that stores Talby's agents, prompts, capability profiles, skills, and tools.
_Avoid_: write repository, task repository

**Custom Agent Repository**:
A separate repository used when a workspace needs agent definitions that differ from the globally available set.
_Avoid_: workspace override inside the shared agent repository

**Evaluation**:
A defined assessment used to measure the quality or fitness of a Capability Profile, Agent, or Prompt.
_Avoid_: ad hoc opinion, runtime outcome

**Workflow**:
An orchestration definition that structures how work is carried out across one or more steps.
_Avoid_: worker, claim owner

**Workflow Run**:
One execution instance of a Workflow for a specific Task or Subtask that owns the Claim while it is actively working.
_Avoid_: worker pool, workflow template

**Workflow Run Outcome**:
The business-level result of a Workflow Run.
_Avoid_: infrastructure status, free-form result string

**Child Workflow Invocation**:
An execution-internal child workflow launched by a Workflow Run to perform bounded work and return a result to the parent run.
_Avoid_: subtask, child task, independent workflow run

**Agent Instance**:
A runtime participation of an Agent spawned by a Workflow Run within a Task Conversation.
_Avoid_: agent definition, worker

**Memory Record**:
A stored fact, event, artifact, or message fragment associated with a Conversation.
_Avoid_: raw chat dump, detached log line

**Memory Query**:
A request to the memory system made in the context of a Participant, a Conversation, and a Workspace.
_Avoid_: global unscoped search, anonymous lookup

**Organization Memory**:
Memory available across the broader Talby system beyond a single Conversation when the external memory system allows it.
_Avoid_: task-local chat history, unrestricted dump

**Memory Feed**:
The baseline set of events and messages that Talby ingests automatically into a Conversation.
_Avoid_: full system exhaust, manual-only save

**Artifact Summary**:
An extracted description, finding set, or metadata record that represents an artifact in memory without storing its full raw contents.
_Avoid_: full binary payload, entire raw log

**First-Hand Record**:
A Memory Record emitted by Talby from observed messages, events, artifacts, or LLM-assisted compression of those observations without adding new inferred facts.
_Avoid_: inferred conclusion, synthetic organizational insight

**Subtask**:
A Talby-internal unit of work derived from a Task and coordinated under that Task's active Claim.
_Avoid_: external child issue, second task claim

## Relationships

- A **Task** originates in exactly one **External Tracker**
- A **Task** belongs to exactly one **Workspace**
- A **Task** may have zero or more **Repository Targets**
- A **Task** may read from zero or more **Repository Targets**
- A **Task** has at most one **Write Repository** in v1
- A **Task** has exactly one active **Conversation** while it is being processed in Talby
- A **Task** has exactly one **Task ID** inside Talby
- A **Task** has exactly one active **Source Reference** to its originating record
- A **Task** may have zero or one active **Execution State** in Talby at a time
- A **Task** has exactly one current **Stage**
- A **Workspace** defines one or more **Eligibility Rules**
- A **Workspace** defines exactly one active **Stage Vocabulary**
- A **Workspace** may govern one or more **External Trackers**
- A **Workspace** may govern zero or more **Repositories**
- A **Workspace** may govern zero or more **Agent Repositories**
- A **Workspace** uses the globally available **Agents** by default
- A **Repository** may have exactly one active **Repository Profile** in Talby
- A **Repository Profile** is stored and versioned inside its **Repository**
- A **Repository** has exactly one **Repository Binding**
- A **Repository Binding** assigns a **Repository** to exactly one **Workspace** by default
- A **Repository Target** links a **Task** to one **Repository** in its **Workspace**
- A **Repository Profile** helps Talby decide whether a **Repository** should be read from or selected as the **Write Repository** for a **Task**
- A **Change Branch** belongs to exactly one **Write Repository**
- A **Pull Request** belongs to exactly one **Write Repository**
- A primary **Pull Request** is produced from exactly one **Change Branch**
- A primary **Pull Request** may be opened before a **Workflow Run** finishes and updated incrementally during execution
- A **Task** may have at most one primary **Pull Request** in v1
- A primary **Pull Request** stays with the **Task** across serial **Workflow Runs** and handoffs by default
- A **Conversation** belongs to exactly one **Task**
- A **Conversation** belongs to exactly one **Workspace** through its **Task**
- A **Conversation** maps to exactly one canonical **Memory Thread** in the external memory system
- A **Conversation** may involve zero or more **Participants**
- A **Conversation** may involve zero or more **Operators**
- A **Conversation** may involve zero or more **Workflow Runs**
- A **Conversation** may involve zero or more humans
- A **Conversation** may involve zero or more **Agent Instances**
- A **Conversation** begins when the **Task** is ingested into Talby
- A **Conversation** normally ends when the **Task** reaches terminal closure in Talby
- A **Conversation** may reopen if the same **Task** is reactivated
- A **Conversation** accumulates **Memory Records** as messages, comments, and task updates arrive
- A **Conversation** contains one or more **Memory Records**
- A **Conversation** has exactly one automatic **Memory Feed** definition in Talby
- In the v1 task detail view, the **Conversation** is the primary panel
- An **Operator** may post directly into a **Conversation**
- The v1 **Operator Action Set** includes posting to the **Conversation**, resolving or reopening an **Attention Item**, triggering a **Handoff**, invoking a **Prompt**, invoking an **Agent** with free-form text, and opening **Pull Request**, **Repository**, or **External Tracker** links
- A **Memory Record** includes the issuing **Participant** identity
- A **Memory Record** may include an artifact reference and an **Artifact Summary**
- Talby emits only **First-Hand Records** into the memory system
- A compressed **First-Hand Record** does not need to preserve provenance to every source input in v1
- **Memory Records** are append-only in v1; corrections are emitted as new records
- A **Memory Query** includes a **Participant**, a **Conversation**, and a **Workspace**
- A **Memory Query** may return both literal **Memory Records** and inferred conclusions from **Organization Memory**
- A **Stage** belongs to exactly one **Stage Vocabulary**
- A **Task** may have zero or one active **Claim** in Talby at a time
- A **Task** may have zero or one active **Workflow Run** in v1
- A **Task** may have zero or more **Tracker Projections** written by Talby
- A **Task** may have zero or more open **Attention Items**
- An **Operator** may review and resolve **Attention Items**
- An **Operator** works primarily from the **Attention Queue** in the v1 UI
- Opening an **Attention Item** takes the **Operator** into a **Task**-centric detail view
- The v1 task view exposes a minimal **Operator Action Set**
- A **Task** is claimable only when it matches an **Eligibility Rule** and has no active **Claim**
- The **Write Repository** is selected during routing before the **Claim** is acquired and the **Workflow Run** starts
- The **Change Branch** strategy is selected during routing before the **Workflow Run** starts
- A **Claim** has exactly one **Lease**
- A **Claim** belongs to exactly one **Workflow Run**
- A **Claim** is acquired before its **Workflow Run** starts executing on the **Task**
- An active **Claim** may be represented in the **External Tracker** by a **Claim Marker**
- A **Handoff** normally releases the active **Claim** on a **Task**
- A completed **Claim** has exactly one **Claim Outcome**
- Only a **Workflow Run** may hold a **Claim**
- A new **Workflow Run** may claim a **Task** only after the previous active **Claim** ends
- A failed **Workflow Run** releases its **Claim** and requires user notification in Talby
- A failed **Workflow Run** creates at least one **Attention Item**
- A **Workflow Run** may create an **Attention Item** and either pause while holding its **Claim** or end and release it, depending on the situation
- A **Task** may have zero or more **Subtasks** while its **Claim** is active
- A **Workflow Run** executes exactly one **Workflow**
- A **Workflow Run** targets exactly one **Task** or one **Subtask**
- A **Workflow Run** may spawn zero or more **Agent Instances**
- A **Workflow Run** may invoke one or more **Agents**
- A **Workflow** step may invoke a predefined **Prompt** with additional parameters or free-form text
- A **Workflow** step may invoke an **Agent** directly with free-form text
- An **Agent** may have access to one or more **Capability Profiles**
- A **Capability Profile** contains one or more **Skills**
- A **Capability Profile** contains zero or more **Tools**
- A **Capability Profile** may include one or more other **Capability Profiles**
- An **Agent** receives **Tool** access only through its **Capability Profiles**
- A **Capability Profile** may have zero or more **Evaluations**
- An **Agent** may have zero or more **Evaluations**
- A **Prompt** targets exactly one **Agent**
- A **Prompt** declares the **Agent** it targets
- A **Prompt** declares one or more required **Capability Profiles**
- A **Prompt** may have zero or more **Evaluations**
- An **Agent Repository** stores one or more **Agents**, **Prompts**, **Capability Profiles**, **Skills**, and **Tools**
- An **Agent Repository** stores one or more **Evaluations**
- A **Custom Agent Repository** stores workspace-specific **Agents**, **Prompts**, **Capability Profiles**, **Skills**, **Tools**, and **Evaluations**
- A **Workflow Run** may launch zero or more **Child Workflow Invocations**
- A completed **Workflow Run** has exactly one **Workflow Run Outcome**
- A **Child Workflow Invocation** belongs to exactly one parent **Workflow Run**
- A **Child Workflow Invocation** does not own a **Claim**, a **Conversation**, or a **Workflow Run** of its own
- A **Child Workflow Invocation** returns its result to the parent **Workflow Run**
- A **Child Workflow Invocation** may fail independently, and the parent **Workflow Run** decides how to handle that failure
- Talby does not auto-retry a failed **Workflow Run** in v1
- An **Agent Instance** participates in exactly one **Conversation**
- An **Agent Instance** is spawned by exactly one **Workflow Run**
- A **Subtask** belongs to exactly one **Task**
- An **External Tracker** owns the canonical lifecycle of its **Tasks**

## Example dialogue

> **Dev:** "If an agent finishes a **Task**, does Talby mark it done itself?"
> **Domain expert:** "No. The **External Tracker** still owns the canonical lifecycle. Talby updates its own **Execution State** and may sync a change back to the tracker."
> **Dev:** "Can two agents start the same **Task** if they see it at the same time?"
> **Domain expert:** "No. Talby requires a **Claim** with an active **Lease** before execution starts."
> **Dev:** "Who actually owns the **Claim** at runtime?"
> **Domain expert:** "A **Workflow Run** owns the **Claim**. It executes one **Workflow** and may spawn **Agent Instances**, but those do not own the claim."
> **Dev:** "Can Talby split one **Task** into parallel work?"
> **Domain expert:** "Yes. One active **Claim** still owns the **Task**, and Talby may create internal **Subtasks** under that claim for parallel execution."
> **Dev:** "Do we use the external system's identifier as the task key inside Talby?"
> **Domain expert:** "No. Talby issues its own **Task ID**. The integration layer keeps the **Source Reference** so Talby does not depend on tracker-specific identity structure."
> **Dev:** "Can one **Task** combine multiple tracker records?"
> **Domain expert:** "Not at the start. One **Task** maps to one originating external record through one active **Source Reference**."
> **Dev:** "Can a **Workflow Run** update the external task while it holds the **Claim**?"
> **Domain expert:** "Yes. The **External Tracker** stays canonical, but Talby may write **Tracker Projections** such as stage changes, comments, summaries, conclusions, evidence, and a **Claim Marker** while the **Claim** is active."
> **Dev:** "If Talby moves the task to the next stage for someone else, does the current **Claim** stay active?"
> **Domain expert:** "No. A **Handoff** releases the current **Claim** by default so the next worker or human can take responsibility."
> **Dev:** "How do we describe why a **Claim** ended?"
> **Domain expert:** "Use a fixed **Claim Outcome** vocabulary: completed, handed_off, abandoned, expired, revoked, or failed."
> **Dev:** "Can a human hold a **Claim** directly in Talby?"
> **Domain expert:** "No. Only a **Workflow Run** may hold a **Claim**. Humans take responsibility through a **Handoff** in the **External Tracker**."
> **Dev:** "Can two **Workflow Runs** work the same **Task** at the same time by claiming it one after another quickly?"
> **Domain expert:** "No. Only one **Workflow Run** may claim a **Task** at a time. A **Handoff** may enable the next **Workflow Run**, but only serially after the current **Claim** ends."
> **Dev:** "What makes a **Task** eligible for Talby to start a **Workflow Run**?"
> **Domain expert:** "Talby configuration defines an **Eligibility Rule**. Tasks that match it are eligible for a **Workflow Run**; the rest are left for humans or are already complete."
> **Dev:** "Is **Stage** the same thing as **Execution State**?"
> **Domain expert:** "No. **Stage** is the normalized external workflow position. **Execution State** is Talby's internal runtime progress while a **Worker** handles the **Task**."
> **Dev:** "Are **Stages** global across all trackers and workspaces?"
> **Domain expert:** "No. Each workspace or integration context defines its own **Stage Vocabulary** in Talby configuration."
> **Dev:** "What is the boundary for **Stage Vocabulary** and **Eligibility Rules**?"
> **Domain expert:** "A **Workspace** is the policy boundary. It defines the **Stage Vocabulary**, the **Eligibility Rules**, and the external sources governed together."
> **Dev:** "Can a **Workspace** govern tasks from more than one **External Tracker**?"
> **Domain expert:** "Yes. A **Workspace** may govern multiple **External Trackers** when they share the same policy boundary."
> **Dev:** "If a **Repository** belongs to one **Workspace**, can another workspace still create a pull request there?"
> **Domain expert:** "Potentially yes at the Git hosting level. **Repository Binding** defines Talby's default policy ownership, not an absolute external permission boundary."
> **Dev:** "If one external task needs changes in specs, code, and E2E repos, does Talby split it into multiple tasks?"
> **Domain expert:** "No. One **Task** may have multiple **Repository Targets** inside its **Workspace** unless the external tracker already models them as separate work items."
> **Dev:** "What is the primary git delivery unit for a **Task**?"
> **Domain expert:** "In v1, Talby delivers work through one primary **Pull Request** on one **Write Repository**, even if the **Task** reads from multiple **Repository Targets**."
> **Dev:** "How does Talby know which repositories are for reading and which one should receive the write?"
> **Domain expert:** "Talby uses a **Repository Profile** on each **Repository**. The profile describes the repository's purpose and routing cues, such as trigger phrases, so the router can choose whether to read from it or select it as the **Write Repository** for a **Task**."
> **Dev:** "Where does the **Repository Profile** live?"
> **Domain expert:** "Inside the **Repository** itself, versioned with the repo so humans and Talby can inspect and evolve it together."
> **Dev:** "When is the **Write Repository** chosen?"
> **Domain expert:** "During routing, before Talby acquires the **Claim** and before the **Workflow Run** starts executing on the **Task**."
> **Dev:** "Is the branch Talby writes to a real domain concept?"
> **Domain expert:** "Yes. A **Change Branch** is the writable branch or equivalent head Talby uses to produce the primary **Pull Request** for a **Task**."
> **Dev:** "Who decides the **Change Branch** naming and strategy?"
> **Domain expert:** "The router does, using workspace policy before the **Workflow Run** starts."
> **Dev:** "Do we open the primary **Pull Request** only at the end?"
> **Domain expert:** "No. The primary **Pull Request** may be opened early and updated incrementally while the **Workflow Run** is still executing."
> **Dev:** "If a **Workflow Run** hands off the **Task**, do we open a new primary **Pull Request** for the next run?"
> **Domain expert:** "No by default. The primary **Pull Request** stays with the **Task** across serial **Workflow Runs** and handoffs unless policy explicitly requires a new one."
> **Dev:** "What is the reusable unit of agent capability?"
> **Domain expert:** "A **Capability Profile**. It is a reusable set of **Skills** and **Tools** that an **Agent** can access during a **Workflow Run**."
> **Dev:** "Who is the primary UI user in v1?"
> **Domain expert:** "An **Operator**. The v1 UI is an operations console for supervising Talby work, intervening when needed, and managing task flow."
> **Dev:** "What does the **Operator** land on first in the UI?"
> **Domain expert:** "The **Attention Queue**. It is the primary working surface in v1."
> **Dev:** "When the **Operator** opens an **Attention Item**, what view is primary?"
> **Domain expert:** "A **Task**-centric detail view. The **Attention Item** explains why the operator arrived there, but the task is the main surface for action."
> **Dev:** "Inside the task view, what panel is primary by default?"
> **Domain expert:** "The **Conversation**. Execution and git context support it, but the conversation is the primary panel in v1."
> **Dev:** "Can the **Operator** write directly into that **Conversation** panel?"
> **Domain expert:** "Yes. An **Operator** may post directly into the **Conversation** in v1."
> **Dev:** "What actions does the **Operator** get from the task view in v1?"
> **Domain expert:** "A minimal **Operator Action Set**: post to the **Conversation**, resolve or reopen an **Attention Item**, trigger a **Handoff**, invoke a **Prompt**, invoke an **Agent** with free-form text, and open **Pull Request**, **Repository**, or **External Tracker** links."
> **Dev:** "What is the difference between **Skills**, **Tools**, **Capability Profiles**, **Agents**, and **Prompts**?"
> **Domain expert:** "**Skills** are instruction folders for doing specific work. **Tools** are configured MCP or CLI integrations plus usage guidance. **Capability Profiles** group sets of **Skills** and **Tools**. **Agents** are personas with access to one or more **Capability Profiles**. **Prompts** are narrower directed commands aimed at a specific **Agent**."
> **Dev:** "Where does that setup live?"
> **Domain expert:** "In an **Agent Repository** of its own, separate from the task write repositories."
> **Dev:** "How do workflow steps invoke the agent system?"
> **Domain expert:** "A workflow step may invoke a predefined **Prompt** with parameters or free-form text, or it may select an **Agent** directly and send a non-predefined free-form instruction that uses the agent's persona and capability access."
> **Dev:** "Can a **Capability Profile** reuse other profiles?"
> **Domain expert:** "Yes. A **Capability Profile** may include other **Capability Profiles** so shared capability sets do not need to be duplicated."
> **Dev:** "Is any free-form instruction a **Prompt**?"
> **Domain expert:** "No. A **Prompt** is a versioned reusable asset in the **Agent Repository**. Free-form runtime instructions are invocation input, not a **Prompt** domain object."
> **Dev:** "Can an **Agent** get **Tools** directly, outside a **Capability Profile**?"
> **Domain expert:** "No. An **Agent** receives **Tool** access only through its **Capability Profiles**."
> **Dev:** "Where do evaluations belong?"
> **Domain expert:** "At all three levels. **Capability Profiles**, **Agents**, and **Prompts** may each have their own **Evaluations**."
> **Dev:** "Are **Agents** enabled per workspace?"
> **Domain expert:** "No by default. **Agents** are globally available. If a workspace needs custom agents, that setup belongs in a separate **Custom Agent Repository**."
> **Dev:** "When a workflow uses a **Prompt**, does it also need to name the **Agent** separately?"
> **Domain expert:** "No. A **Prompt** declares the **Agent** it targets, so the workflow does not need to repeat that mapping."
> **Dev:** "Does a **Prompt** declare its capability expectations too?"
> **Domain expert:** "Yes. A **Prompt** declares the required **Capability Profiles** alongside its target **Agent**."
> **Dev:** "What is the primary unit of memory ingestion?"
> **Domain expert:** "A **Conversation** is the primary unit. It belongs to a **Task**, starts when the **Task** is ingested into Talby, and grows as humans and **Agent Instances** add messages, comments, and updates."
> **Dev:** "What happens if the **Task** is completed and later reactivated?"
> **Domain expert:** "Use one **Conversation** per **Task** lifecycle and reopen that same **Conversation** if the **Task** is reactivated."
> **Dev:** "How does Talby scope memory retrieval?"
> **Domain expert:** "Talby sends the issuing **Participant** identity plus the **Conversation** and **Workspace** context in each **Memory Query**. The external memory system enforces filtering and may return literal messages from other participants or inferred conclusions from **Organization Memory**."
> **Dev:** "What gets written into memory automatically?"
> **Domain expert:** "Talby defines a baseline **Memory Feed** for each **Conversation**. It automatically ingests task ingestion data, task comments and updates, worker and human conversation messages, claim lifecycle events, handoff events, and links to artifacts or evidence."
> **Dev:** "Do we store full artifact contents in memory?"
> **Domain expert:** "Not by default. Memory stores artifact references plus an **Artifact Summary**, while raw artifact contents stay in their source system."
> **Dev:** "Do inferred summaries and conclusions become memory automatically?"
> **Domain expert:** "No. Talby emits only **First-Hand Records**. The memory system may derive new conclusions from them, but that inferred knowledge is not emitted by Talby as a record."
> **Dev:** "Must a compressed **First-Hand Record** preserve links back to every original input?"
> **Domain expert:** "Not in v1. LLM-assisted compression is allowed without full per-input provenance as long as Talby still treats the result as a **First-Hand Record** rather than an inference."
> **Dev:** "Can one **Conversation** span multiple external memory threads?"
> **Domain expert:** "No in v1. Each **Conversation** maps to exactly one canonical **Memory Thread** in the external memory system."
> **Dev:** "If a **Memory Record** is wrong, do we edit it?"
> **Domain expert:** "No in v1. **Memory Records** are append-only. Corrections are emitted as new records."
> **Dev:** "What does the scheduler actually start?"
> **Domain expert:** "The scheduler starts a **Workflow Run**. That run may spawn **Agent Instances** that participate in the Task's **Conversation**."
> **Dev:** "When does the **Workflow Run** start relative to the **Claim**?"
> **Domain expert:** "Talby routes the **Task** to a **Workflow**, acquires the **Claim**, and only then starts the **Workflow Run** executing on the **Task**."
> **Dev:** "Can more than one **Workflow Run** exist for the same **Task** at the same time if only one is executing?"
> **Domain expert:** "No in v1. A **Task** may have at most one active **Workflow Run** at a time."
> **Dev:** "How do we describe the result of a **Workflow Run**?"
> **Domain expert:** "Use a fixed **Workflow Run Outcome** vocabulary: completed, handed_off, failed, or canceled."
> **Dev:** "What happens when a **Workflow Run** fails?"
> **Domain expert:** "Talby does not auto-retry it in v1. The failed **Workflow Run** releases its **Claim**, and Talby notifies a user so the next action is decided explicitly."
> **Dev:** "Is that notification just infrastructure, or a domain concept?"
> **Domain expert:** "It is a domain concept. Talby creates an **Attention Item** whenever a human needs to intervene or acknowledge the next step for a **Task**."
> **Dev:** "If a **Workflow Run** needs parallel internal work, is that a **Subtask**?"
> **Domain expert:** "Not necessarily. Execution fan-out uses a **Child Workflow Invocation**. It does not own a **Claim**, **Conversation**, or separate **Workflow Run**. A **Subtask** is still a task-management concept tied to the parent **Task**."
> **Dev:** "If a **Child Workflow Invocation** fails, does that automatically fail the parent run?"
> **Domain expert:** "No. A **Child Workflow Invocation** may fail independently, and the parent **Workflow Run** decides whether to recover, block, or fail the overall run."
> **Dev:** "If a **Workflow Run** creates an **Attention Item**, does it always end immediately?"
> **Domain expert:** "No. Some **Attention Items** pause the **Workflow Run** while it still holds the **Claim**. Others end the run and release the claim."

## Flagged ambiguities

- "status" was used to mean both tracker lifecycle and Talby progress metadata — resolved: use **Execution State** for Talby-managed progress, and reserve task lifecycle for the **External Tracker**.
- "assignment" could imply a durable owner — resolved: use **Claim** for exclusive execution rights and **Lease** for the bounded ownership window.
- "agent" could mean both a reusable capability and a running executor — resolved: use **Agent** for the capability definition and **Agent Instance** for the runtime participant.
- "subtask" could be mistaken for an external tracker child item — resolved: use **Subtask** only for Talby-internal derived work under a Task's active **Claim**.
- "task id" could mean either Talby's identifier or the tracker's identifier — resolved: use **Task ID** for the Talby-generated identifier and **Source Reference** for the external mapping.
- "task" could be overloaded to mean a bundle of external records — resolved: a **Task** maps one-to-one to one originating external record at the start.
- "ownership" could imply Talby and the tracker both own the same fields — resolved: the **External Tracker** remains canonical, and Talby writes explicit **Tracker Projections** into it.
- "stage change" could mean either continued work or transfer of responsibility — resolved: use **Handoff** when the stage change is meant to release the current **Claim**.
- "why the claim ended" could drift into free-form text — resolved: use the fixed **Claim Outcome** vocabulary: completed, handed_off, abandoned, expired, revoked, failed.
- "responsibility" could imply either Talby runtime ownership or external human assignment — resolved: only **Workflow Runs** hold **Claims**; humans receive work through **Handoff** in the **External Tracker**.
- "multiple workers on one task" could imply concurrent top-level ownership — resolved: top-level **Claims** are serial across **Workflow Runs**, not concurrent.
- "task configuration" was too vague — resolved: use **Eligibility Rule** for Talby configuration that decides whether a **Task** is eligible for a **Workflow Run**.
- "status" risked becoming overloaded again — resolved: use **Stage** for normalized external workflow position and **Execution State** for Talby runtime progress.
- "stage" could imply one universal workflow taxonomy — resolved: each workspace or integration context has its own **Stage Vocabulary**.
- "local configuration" needed a clear boundary — resolved: a **Workspace** is Talby's policy boundary for **Stage Vocabulary**, **Eligibility Rules**, and governed external sources.
- "workspace" could be mistaken for one tracker connection only — resolved: a **Workspace** may govern multiple **External Trackers**.
- "repository belongs to one workspace" could be mistaken for hard Git isolation — resolved: **Repository Binding** is Talby's default policy ownership, not a guarantee that other workspaces cannot act at the Git host level.
- "repository work" could be mistaken for separate tasks by default — resolved: one **Task** may have multiple **Repository Targets** within its **Workspace**.
- "multi-repo work" could imply multi-repo writes by default — resolved: in v1 a **Task** may read many repositories, but it has at most one primary **Pull Request** on one **Write Repository**.
- "repository purpose" could drift into undocumented routing folklore — resolved: use **Repository Profile** for Talby-managed repository metadata that drives read and write selection.
- "repository profile" could be mistaken for central-only config — resolved: a **Repository Profile** lives inside and is versioned with its **Repository**.
- "write repository selection" could be mistaken for an in-run discovery step — resolved: the **Write Repository** is chosen during routing before claim acquisition and run start.
- "branch" could be dismissed as pure infrastructure detail — resolved: use **Change Branch** for the writable head that produces the primary **Pull Request**.
- "branch strategy" could be mistaken for workflow-local behavior — resolved: the router selects the **Change Branch** strategy from policy before execution starts.
- "pull request" could be mistaken for an end-of-run artifact only — resolved: the primary **Pull Request** may be opened early and updated throughout execution.
- "pull request ownership" could drift from task-level continuity to run-level churn — resolved: the primary **Pull Request** stays with the **Task** across serial handoffs by default.
- "agent definition" was too thin to carry prompts, skills, and tools coherently — resolved: use **Capability Profile** for reusable sets of **Skills** and **Tools**, and **Agent** for the persona that uses them.
- "skill", "tool", "capability profile", and "prompt" were starting to blur — resolved: each now has a distinct role in the agent system.
- "capability profile" could drift into duplicated flat bundles only — resolved: **Capability Profiles** may include other **Capability Profiles**.
- "prompt" could be mistaken for any ad hoc instruction — resolved: **Prompt** means a versioned reusable asset; free-form runtime text is invocation input.
- "tool access" could be granted through competing paths — resolved: **Tools** are granted to an **Agent** only through **Capability Profiles**.
- "evaluation ownership" could collapse into one layer only — resolved: **Evaluations** exist at the **Capability Profile**, **Agent**, and **Prompt** levels.
- "workspace-specific agents" could imply per-workspace toggles in the shared catalog — resolved: **Agents** are globally available by default; workspace-specific variants live in a separate **Custom Agent Repository**.
- "prompt target" could be repeated in workflow definitions — resolved: each **Prompt** declares the **Agent** it targets.
- "prompt capability needs" could stay implicit — resolved: each **Prompt** declares the required **Capability Profiles** it expects.
- "memory ingestion" could drift down to raw messages only — resolved: **Conversation** is the primary ingestion unit, and it accumulates **Memory Records** incrementally.
- "conversation" could be mistaken for a feature-wide thread — resolved: a **Conversation** is scoped to one **Task**, not to an entire feature.
- "conversation end" could imply permanent closure — resolved: a **Conversation** normally ends with terminal task closure but may reopen if the **Task** is reactivated.
- "project id" conflicted with Talby's policy-boundary term — resolved: use **Workspace** for the scoped context sent with a **Memory Query**.
- "message author" was too narrow — resolved: use **Participant** for the human or **Agent** identity that issues a **Memory Record** or **Memory Query**.
- "ui user" could be mistaken for a general end user — resolved: the primary v1 UI user is an **Operator**.
- "landing page" could drift into passive reporting — resolved: the primary v1 UI working surface is the **Attention Queue**.
- "attention item detail" could overshadow the actual unit of action — resolved: opening an **Attention Item** leads to a **Task**-centric view.
- "task detail priority" could drift toward dashboards or git state — resolved: the **Conversation** is the primary panel in the v1 task detail view.
- "conversation panel" could be mistaken for read-only history — resolved: an **Operator** may post directly into the **Conversation**.
- "task view actions" could sprawl into a full admin surface — resolved: v1 exposes a minimal **Operator Action Set** focused on intervention and supervision.
- "memory ingestion" could mean either baseline automatic capture or explicit agent writes — resolved: use **Memory Feed** for the automatic baseline, while agents may still add explicit records.
- "artifact in memory" could imply full raw content storage — resolved: store references plus **Artifact Summary** by default, not the full artifact payload.
- "summary" could imply Talby is inferring new knowledge — resolved: Talby may compress observations with an LLM, but it still emits only **First-Hand Records**; inference belongs to the memory system.
- "compressed first-hand record" could imply source-trace guarantees — resolved: v1 does not require full provenance to every source input.
- "conversation in Talby" could be mistaken for multiple external memory threads — resolved: each **Conversation** maps to one canonical **Memory Thread** in v1.
- "fixing memory" could imply mutating history — resolved: **Memory Records** are append-only in v1, and corrections are new records.
- "agent" risked becoming overloaded again at execution time — resolved: use **Agent Instance** for the runtime participation spawned by a **Workflow Run**.
- "worker" risked being treated as a business concept — resolved: **Worker** is infrastructure-only; claim ownership and task responsibility belong to the **Workflow Run** in the domain model.
- "workflow run start" could be confused with routing or claim acquisition — resolved: routing happens first, the **Claim** is acquired next, and execution starts after that.
- "active workflow runs" could imply queued parallel ownership on one task — resolved: a **Task** may have at most one active **Workflow Run** in v1.
- "run result" could drift into infrastructure-specific states — resolved: use the fixed **Workflow Run Outcome** vocabulary: completed, handed_off, failed, canceled.
- "retry" could imply Talby-managed reruns of failed execution — resolved: Talby does not auto-retry failed **Workflow Runs** in v1; failure releases the **Claim** and triggers user notification.
- "notification" could be mistaken for pure delivery plumbing — resolved: use **Attention Item** for the domain concept that a human must intervene or acknowledge a Task.
- "subtask" could be confused with execution-internal parallel work — resolved: use **Child Workflow Invocation** for child execution launched from a parent **Workflow Run**; reserve **Subtask** for task-management decomposition.
- "child workflow failure" could imply automatic parent failure — resolved: child failures are interpreted by the parent **Workflow Run**.
- "attention" could imply immediate run termination in all cases — resolved: an **Attention Item** may either pause a **Workflow Run** with its **Claim** intact or end the run and release the **Claim**, depending on the situation.
