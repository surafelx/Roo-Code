# TRP1 Challenge Final Submission

## Architecting the AI-Native IDE & Intent-Code Traceability

---

## 1. Executive Summary

Software engineering is transitioning from manual syntax production to orchestration of AI agents. In this paradigm, the bottleneck is no longer code generation but governance, context management, and verification.

Traditional version control systems such as GitHub-style Git workflows track what changed at the line level, but remain blind to:

- **Why** a change occurred (Intent)
- **Whether** a change preserves behavior (Refactor) or introduces new capability (Feature)
- **Whether** the system remains within defined architectural constraints

AI-driven development introduces two structural risks:

- **Cognitive Debt** — Humans skim AI output without deeply understanding system state.
- **Trust Debt** — There is no deterministic linkage between business intent and generated code.

This project upgrades an existing AI coding extension (Roo/Cline fork) into a **Governed AI-Native IDE** by introducing:

- A Deterministic Hook Engine (middleware boundary)
- A Two-Stage Intent State Machine
- An AI-Native Git Layer with Intent-AST correlation
- Cryptographic mutation hashing (SHA-256)
- Parallel Orchestration with Optimistic Locking
- Machine-managed orchestration artifacts

The result is a system where:

- The agent cannot act without selecting a formalized intent.
- All code mutations are cryptographically linked to business requirements.
- Parallel agents cannot overwrite each other silently.
- Documentation evolves automatically as a side-effect of execution.

This replaces blind trust with verifiable traceability.

---

## 2. Baseline Architecture & Problem Framing

### 2.1 Baseline (Unmodified Roo/Cline)

**Original architecture:**

```
User → LLM → Tool Execution → Result → LLM
```

**Characteristics:**

- Reactive tool loop
- No formal intent selection
- No scope enforcement
- No semantic traceability
- No parallel coordination safeguards

The LLM can directly:

- Write files
- Execute commands
- Modify project structure

This creates a "Vibe Coding" environment where architectural drift and context rot accumulate over time.

---

## 3. Upgraded Architecture Overview

### 3.1 Core Architectural Upgrade

The system was upgraded by inserting a deterministic governance layer between reasoning and execution.

**New execution flow:**

```
User
↓
LLM (Intent Declaration Required)
↓
Two-Stage Intent State Machine
↓
Hook Engine (Pre/Post Interceptor)
↓
Tool Execution
↓
AI-Native Ledger Update
```

### 3.2 Component Separation

#### 1. Webview (Presentation Layer)

- Emits user events
- Displays orchestration state
- No file system privileges
- Communicates via postMessage

#### 2. Extension Host (Logic Layer)

- Tool registry
- LLM API integration
- File system access
- Git access

#### 3. Hook Engine (Middleware Boundary – Innovation)

- Intercepts every tool call
- Enforces scope
- Injects curated context
- Performs hashing
- Logs semantic mutations
- Blocks violations
- Implements optimistic concurrency

This separation ensures:

- Clean middleware pattern
- Composability
- Fail-safe boundaries
- No spaghetti logic in dispatcher

---

## 4. The Two-Stage Intent State Machine

### 4.1 The Context Paradox

An AI agent cannot be given intent context until it identifies which intent it is operating under.

**Therefore:**

The agent must declare intent before being allowed to modify code.

### 4.2 State 1: Intent Checkout (Handshake)

**Mandatory tool:** `select_active_intent(intent_id: string)`

**Pre-Hook Responsibilities:**

1. Validate ID exists in `active_intents.yaml`
2. Load:
    - `owned_scope`
    - `constraints`
    - `acceptance_criteria`
    - `recent trace entries`
3. Inject curated context:

```xml
<intent_context>
  <id>INT-001</id>
  <constraints>
    Must not use external auth providers
  </constraints>
  <scope>
    src/auth/**
  </scope>
</intent_context>
```

**If:**

- No intent selected → Block execution
- Invalid ID → Return structured tool error

The agent is now context-bound.

### 4.3 State 2: Contextualized Execution

When `write_file` is called:

**Pre-Hook:**

- Verify active intent selected
- Verify file ∈ owned_scope
- Classify mutation
- Perform optimistic lock check

**Post-Hook:**

- Compute SHA-256 hash of modified block
- Bind change to intent ID
- Append to ledger
- Update intent lifecycle if needed

This transforms the LLM from generative to governed.

---

## 5. Orchestration Data Model (.orchestration/)

A machine-managed directory ensures durable, inspectable state.

### 5.1 active_intents.yaml

**Purpose:** Formalizes business requirements as first-class entities.

**Structure:**

- `id` - Unique identifier
- `name` - Human-readable name
- `status` - Current lifecycle state
- `owned_scope` - Files this intent can modify
- `constraints` - Architectural restrictions
- `acceptance_criteria` - Success conditions

**Update Pattern:**

- Modified during intent checkout
- Updated when completed
- Used as authority for scope enforcement

This prevents architectural drift.

### 5.2 agent_trace.jsonl (The Ledger)

Append-only semantic mutation ledger.

Each entry contains:

- `uuid` - Unique identifier
- `timestamp` - ISO 8601 timestamp
- `git_revision` - Current VCS reference
- `file_path` - Modified file
- `contributor` - Agent identifier
- `mutation_ranges` - Changed line ranges
- `content_hash` - SHA-256 of content
- `intent_id` - Related business intent
- `mutation_class` - AST_REFACTOR or INTENT_EVOLUTION

This replaces line diffs with intent-linked semantic tracking.

### 5.3 intent_map.md

**Purpose:** Maps business domain → File paths → Logical components

Enables answering: "Where is billing logic implemented?"

Updated when INTENT_EVOLUTION occurs.

### 5.4 CLAUDE.md (Shared Brain)

Inspired conceptually by agent workflows from Anthropic and the IDE-as-manager philosophy seen in Cursor.

**Stores:**

- Lessons learned
- Architectural decisions
- Verification failures
- Style constraints

Prevents knowledge decay across parallel sessions.

---

## 6. Hook Engine Implementation

### 6.1 Middleware Design

Hooks implemented in: `src/hooks/`

**Separation:**

- `PreToolUseHook` - Pre-execution interception
- `PostToolUseHook` - Post-execution logging

No direct logic inserted into core dispatcher.

### 6.2 Command Classification

**Safe commands:**

- `read_file`
- `list_directory`

**Destructive commands:**

- `write_file`
- `delete_file`
- `execute_command`

Destructive actions require:

- Intent validation
- Scope verification
- Optional Human-in-the-Loop approval

### 6.3 Human-in-the-Loop (HITL)

For high-risk actions:

- `vscode.window.showWarningMessage`
- Approve / Reject

**If rejected:**

- Return structured JSON tool error
- LLM self-corrects without crash

---

## 7. AI-Native Git Layer

### 7.1 Why Traditional Git Is Insufficient

Traditional Git:

- Tracks line changes
- Cannot distinguish refactor vs feature
- Cannot link code to business intent

This project introduces semantic traceability.

### 7.2 Content Hashing Strategy

- SHA-256 computed on modified block
- Independent of line numbers
- Ensures spatial independence
- Survives code movement

This repays Trust Debt.

### 7.3 Mutation Classification

**Two classes:**

#### AST_REFACTOR

- No new exports
- No API surface change
- No acceptance criteria update
- Functional preservation

#### INTENT_EVOLUTION

- New file
- New export
- New route
- Acceptance criteria modification

Classification is deterministic and tied to file structure changes.

---

## 8. Parallel Orchestration

### 8.1 The Problem

Parallel agents can overwrite each other silently.

### 8.2 Optimistic Locking

**On read:**

- Hash stored in task context

**On write:**

- Current disk hash computed
- Compared to stored hash
- If mismatch → Block execution
- Return "Stale File" error
- Force re-read

This prevents silent corruption.

### 8.3 Hive Mind Behavior

Parallel sessions:

- Share CLAUDE.md
- Share intent ledger
- Respect owned_scope
- Cannot collide silently

The IDE behaves as a coordinated system, not independent chat sessions.

---

## 9. Proof of Execution Summary

Demonstrated:

- ✅ Fresh workspace with active_intents.yaml
- ✅ Mandatory intent checkout
- ✅ Context injection via XML block
- ✅ Real-time ledger updates
- ✅ Scope violation blocking
- ✅ Parallel conflict blocking
- ✅ mutation_class correctly logged
- ✅ SHA-256 content hashes generated
- ✅ All orchestration artifacts persisted under .orchestration/

---

## 10. Architectural Decisions & Tradeoffs

| Decision       | Choice                     | Rationale                                               |
| -------------- | -------------------------- | ------------------------------------------------------- |
| Intent Storage | YAML (active_intents.yaml) | Human-readable, Spec-driven development alignment       |
| Ledger Format  | JSONL                      | Append-only, Stream-friendly, Audit-compatible          |
| Hash Algorithm | SHA-256                    | Collision resistance, Industry standard                 |
| Concurrency    | Optimistic Locking         | Non-blocking, Lightweight, Suitable for agent workflows |
| Architecture   | Middleware Isolation       | Composability, Testability, Clear security boundary     |

---

## 11. Limitations

- Full AST semantic diffing not implemented (heuristic classification used)
- Intent language formalization not fully AISpec-compliant
- SQLite-backed orchestration DB could improve scalability
- No distributed orchestration layer

These are future extensions.

---

## 12. Future Work

- AST-based structural equivalence detection
- Formal Intent DSL
- SpecKit integration
- Intent graph visualization
- Cross-repository intent federation
- Deterministic replay of ledger events

---

## 13. Rubric Mapping

| Requirement                | Implementation                                                  |
| -------------------------- | --------------------------------------------------------------- |
| **Intent-AST Correlation** | SHA-256 + intent binding + mutation_class                       |
| **Context Engineering**    | Mandatory intent checkout, Curated injection, Scope enforcement |
| **Hook Architecture**      | Clean middleware pattern, Isolated in src/hooks/                |
| **Orchestration**          | Optimistic locking, Shared Brain, Parallel conflict prevention  |

---

## 14. Conclusion

This project transforms an AI coding assistant into a governed AI-Native IDE by introducing:

- **Deterministic execution** through mandatory intent checkout
- **Intent-code traceability** through cryptographic mutation binding
- **Parallel safety** through optimistic locking
- **Knowledge persistence** through shared brain pattern

The system:

- Prevents uncontrolled AI drift
- Repays Cognitive Debt through structured context
- Repays Trust Debt through cryptographic traceability
- Enables safe parallel agent orchestration

It demonstrates that the future of AI software engineering is not faster generation — but **stronger governance**.

---

## Implementation Files

| File                                                | Purpose                                    |
| --------------------------------------------------- | ------------------------------------------ |
| `src/core/services/IntentPreHook.ts`                | Pre-execution hook for intent validation   |
| `src/core/tools/SelectActiveIntentTool.ts`          | Intent selection tool                      |
| `src/core/services/ParallelOrchestrationService.ts` | Stale file detection via content hashing   |
| `src/core/services/AgentTraceService.ts`            | AI-Native Git layer with mutation tracking |
| `src/core/tools/RecordLessonTool.ts`                | Lesson recording to CLAUDE.md              |
| `active_intents.yaml`                               | Intent configuration                       |
| `.orchestration/agent_trace.jsonl`                  | Mutation ledger                            |
| `.orchestration/intent_map.md`                      | Domain-component mapping                   |
| `CLAUDE.md`                                         | Shared brain for parallel sessions         |

---

_Generated for TRP Week 1 Challenge_
_Branch: feature/parallel-orchestration_
