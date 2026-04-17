# State Machine Engine V2 Specification

## Reducer-Based, Runtime-Agnostic, ASL-Centric Execution Model

## Status

Draft

## Purpose

This document specifies the architecture and behavioral model for **V2** of the state machine engine.

V2 replaces the current in-memory, run-to-completion interpreter model with a **step-based execution model** in which:

- execution state is explicit,
- transitions are observable,
- side effects are externalized,
- replay and resume are first-class,
- the core engine is **agnostic to storage, scheduling, process lifetime, and cloud provider details**.

V2 is designed to support:

- deterministic step-by-step execution,
- persisted long-lived executions,
- resumability,
- debugging and replay,
- unit testing of intermediate execution mutations,
- alternate runtimes beyond AWS-specific environments.

---

# 1. Design Goals

## 1.1 Primary Goals

V2 must:

1. **Model execution as explicit state**
   - The current point of execution must be represented as serializable data.
   - Continuation must not depend on an in-memory call stack, thread, generator, or recursive interpreter state.

2. **Expose one-step execution**
   - The core engine must advance an execution by processing **one input action at a time**.
   - The engine must not own the outer loop.

3. **Separate pure state-machine logic from runtime concerns**
   - ASL interpretation must be separated from:
     - persistence,
     - IO,
     - scheduling,
     - timers,
     - task invocation,
     - concurrency execution,
     - cloud provider specifics.

4. **Support replay and resume**
   - An execution must be resumable from persisted state.
   - Rebuilding execution state from a sequence of actions must be possible.
   - Snapshots/checkpoints may be used to optimize rebuild time.

5. **Enable explicit side-effect handling**
   - The engine must not perform external side effects directly.
   - The engine must emit effects declaratively.
   - A runtime/orchestrator layer must execute effects and feed results back into the engine as actions.

6. **Be ASL/generic-state-machine first**
   - The core must reflect the semantics of Amazon States Language (ASL) and generic workflow/state-machine behavior.
   - AWS-specific names, APIs, history shapes, and resource integrations must be adapters/projections outside the core.

---

## 1.2 Secondary Goals

V2 should:

- produce rich execution history,
- support AWS-compatible history projection,
- support manual stepping and debugging,
- support child executions for `Parallel` and `Map`,
- support effect lifecycle tracking,
- support modern ASL concepts such as variables and assignment,
- remain testable with no infrastructure dependencies.

---

# 2. Non-Goals

V2 core is **not** responsible for:

- database implementation,
- queue implementation,
- thread/process model,
- timer backend implementation,
- AWS API emulation by itself,
- Lambda or Activity transport details,
- IAM or AWS credential semantics,
- CloudWatch integration,
- networking,
- distributed locking,
- monitoring backend implementation.

These concerns belong to runtime adapters or integration layers.

---

# 3. Core Architectural Separation

V2 is split into **four layers**.

---

## 3.1 Layer A — ASL Core Engine

This layer is **pure** and **runtime-agnostic**.

Responsibilities:

- interpret ASL/generic state-machine semantics,
- hold execution state,
- process actions,
- produce:
  - next execution state,
  - declared effects,
  - machine events.

This layer must not:

- perform IO,
- read the clock directly,
- generate random values directly,
- spawn threads,
- schedule timers,
- call tasks directly,
- persist state directly.

---

## 3.2 Layer B — Runtime / Execution Driver

This layer is responsible for orchestration around the core.

Responsibilities:

- load/store execution state,
- call the reducer,
- persist transition records,
- persist effect records,
- execute or schedule declared effects,
- translate effect outcomes into actions,
- handle resume/redrive,
- coordinate child executions.

This layer may be:

- in-memory,
- test-only,
- database-backed,
- queue-backed,
- API-driven,
- worker-based.

---

## 3.3 Layer C — Resource / Effect Adapters

This layer implements concrete external capabilities.

Examples:

- task invocation adapter,
- clock/timer adapter,
- branch execution launcher,
- map item launcher,
- activity worker adapter,
- custom integration handlers.

This layer is runtime-specific.

---

## 3.4 Layer D — AWS Compatibility Projection

This layer maps generic execution state and generic events into AWS-like APIs and history formats.

Responsibilities:

- project internal history into AWS Step Functions execution history shapes,
- expose AWS-compatible event names where needed,
- translate generic task runtime events into AWS-specific event families,
- provide compatibility APIs such as:
  - DescribeExecution,
  - GetExecutionHistory,
  - StartExecution,
  - StopExecution.

Important:

- AWS compatibility is a **projection**, not the engine’s internal truth model.

---

# 4. Terminology

## 4.1 Definition

A static ASL or generic state machine definition.

## 4.2 Execution

A running or completed instance of a definition.

## 4.3 Execution Control

The control-oriented part of execution state:

- current state,
- status,
- continuation frame.

## 4.4 Execution Data

The data-oriented part of execution state:

- original input,
- current payload,
- output,
- error,
- variables.

## 4.5 Action

An input to the core engine describing something that happened and should advance the execution.

Examples:

- `START`
- `CONTINUE`
- `TASK_SUCCEEDED`
- `TASK_FAILED`
- `WAKE`
- `BRANCH_COMPLETED`

## 4.6 Effect

A declarative request emitted by the core engine asking the runtime to perform something externally.

Examples:

- `INVOKE_TASK`
- `SCHEDULE_WAKE`
- `START_BRANCH`
- `START_MAP_ITEM`

## 4.7 Machine Event

A generic engine-level event produced by the reducer to describe semantic execution changes.

Examples:

- `ExecutionStarted`
- `StateEntered`
- `StateExited`
- `ExecutionSucceeded`
- `ExecutionFailed`

## 4.8 Runtime Event

An event produced by the runtime while executing effects.

Examples:

- `TaskScheduled`
- `TaskStarted`
- `TaskSucceeded`
- `TaskFailed`

## 4.9 Transition Record

A technical record of one reducer step:

- before state,
- action,
- after state,
- emitted effects,
- machine events.

## 4.10 History Event

An observable event in projected execution history, potentially AWS-compatible.

---

# 5. Core Data Model

---

## 5.1 Definition

```ts
type Definition = {
  startAt: string;
  states: Record<string, StateDefinition>;
};
```

`StateDefinition` is the union of supported ASL state kinds.

```ts
type StateDefinition =
  | PassState
  | TaskState
  | ChoiceState
  | WaitState
  | ParallelState
  | MapState
  | SucceedState
  | FailState;
```

---

## 5.2 Execution

```ts
type Execution = {
  id: string;
  definition: Definition;

  control: ExecutionControl;
  data: ExecutionData;
  meta: ExecutionMeta;
};
```

---

## 5.3 Execution Control

```ts
type ExecutionControl = {
  status: ExecutionStatus;
  stateName: string | null;
  frame: ExecutionFrame;
};
```

```ts
type ExecutionStatus = 'READY' | 'RUNNING' | 'WAITING' | 'SUCCEEDED' | 'FAILED';
```

Notes:

- `READY` means initialized but not yet started.
- `RUNNING` means ready for immediate reducer advancement.
- `WAITING` means execution is blocked on an external condition.
- `SUCCEEDED` and `FAILED` are terminal.

---

## 5.4 Execution Data

```ts
type ExecutionData = {
  input: unknown;
  current: unknown;
  output?: unknown;
  error?: ExecutionFailure;
  variables?: Record<string, unknown>;
};
```

```ts
type ExecutionFailure = {
  error: string;
  cause?: string;
};
```

Notes:

- `input` is the original execution input.
- `current` is the current working payload for the active state.
- `output` is the final result once terminal success is reached.
- `error` is the current execution failure payload if relevant.
- `variables` is reserved for ASL variable assignment / modern features.

---

## 5.5 Execution Meta

```ts
type ExecutionMeta = {
  version: number;
  startedAt?: string;
  finishedAt?: string;

  definitionVersion?: string;
  engineVersion?: string;
};
```

Notes:

- `version` increments on every successful transition.
- `definitionVersion` and `engineVersion` are recommended for replay safety.

---

# 6. Continuation Model

V2 does not use hidden interpreter stack or generator continuation.

Continuation is explicit in `ExecutionControl.frame`.

---

## 6.1 Execution Frame

```ts
type ExecutionFrame = { kind: 'STATE' } | TaskFrame | WaitFrame | ParallelFrame | MapFrame;
```

### Task frame

```ts
type TaskFrame = {
  kind: 'TASK';
  stateName: string;
  effectId: string;
  resourceType?: string;
  resource: string;
  attempt: number;
};
```

### Wait frame

```ts
type WaitFrame = {
  kind: 'WAIT';
  stateName: string;
  effectId: string;
  until: string;
};
```

### Parallel frame

```ts
type ParallelFrame = {
  kind: 'PARALLEL';
  stateName: string;
  branches: ParallelBranchStatus[];
};
```

```ts
type ParallelBranchStatus = {
  branchId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  result?: unknown;
  failure?: ExecutionFailure;
};
```

### Map frame

```ts
type MapFrame = {
  kind: 'MAP';
  stateName: string;
  itemsTotal: number;
  completed: number;
  failed: number;
};
```

Notes:

- The frame describes **how execution resumes**.
- `stateName` says where execution is.
- `frame` says what is pending or active inside that state.

---

# 7. Action Model

The engine advances only by consuming actions.

---

## 7.1 Generic Action Type

```ts
type ExecutionAction =
  | { type: 'START' }
  | { type: 'CONTINUE' }
  | {
      type: 'TASK_SUCCEEDED';
      effectId: string;
      result: unknown;
    }
  | {
      type: 'TASK_FAILED';
      effectId: string;
      error: string;
      cause?: string;
    }
  | {
      type: 'WAKE';
      effectId: string;
      at: string;
    }
  | {
      type: 'BRANCH_STARTED';
      branchId: string;
    }
  | {
      type: 'BRANCH_COMPLETED';
      branchId: string;
      result: unknown;
    }
  | {
      type: 'BRANCH_FAILED';
      branchId: string;
      error: string;
      cause?: string;
    }
  | {
      type: 'MAP_ITEM_COMPLETED';
      itemId: string;
      result: unknown;
    }
  | {
      type: 'MAP_ITEM_FAILED';
      itemId: string;
      error: string;
      cause?: string;
    };
```

---

## 7.2 Design Rule

All non-deterministic or external outcomes must arrive through actions.

The core engine must never directly call:

- `Date.now()`,
- `Math.random()`,
- external services,
- timer backends.

If time/random/IDs are needed as execution inputs, they must be resolved by the runtime and returned as actions.

---

# 8. Effect Model

Effects are declarative requests emitted by the reducer.

---

## 8.1 Generic Effect Type

```ts
type ExecutionEffect =
  | {
      type: 'INVOKE_TASK';
      effectId: string;
      stateName: string;
      resourceType?: string;
      resource: string;
      input: unknown;
    }
  | {
      type: 'SCHEDULE_WAKE';
      effectId: string;
      stateName: string;
      until: string;
    }
  | {
      type: 'START_BRANCH';
      effectId: string;
      stateName: string;
      branchId: string;
      definition: Definition;
      input: unknown;
    }
  | {
      type: 'START_MAP_ITEM';
      effectId: string;
      stateName: string;
      itemId: string;
      input: unknown;
    };
```

---

## 8.2 Design Rule

Effects are not executed in the reducer.
The reducer only declares them.

The runtime is responsible for:

- persisting them,
- dispatching them,
- tracking lifecycle,
- translating effect outcomes into actions.

---

# 9. Machine Event Model

Machine events are emitted by the core reducer to describe semantic state-machine changes.

```ts
type ExecutionMachineEvent =
  | { type: 'ExecutionStarted'; input: unknown }
  | { type: 'StateEntered'; stateName: string; stateType: string; input: unknown }
  | { type: 'StateExited'; stateName: string; stateType: string; output: unknown }
  | { type: 'ExecutionSucceeded'; output: unknown }
  | { type: 'ExecutionFailed'; error: string; cause?: string };
```

Notes:

- Machine events are generic.
- They are not AWS-specific history events.
- They are inputs for history projection.

---

# 10. Reducer Contract

The V2 core engine is a reducer-like interface.

```ts
type ReduceResult = {
  execution: Execution;
  effects: ExecutionEffect[];
  machineEvents: ExecutionMachineEvent[];
};

type ReduceExecution = (execution: Execution, action: ExecutionAction) => ReduceResult;
```

---

## 10.1 Invariants

For any valid call to `reduce(execution, action)`:

1. The function must be deterministic for the same inputs.
2. The returned `execution` must be a new logical version.
3. The reducer must not perform external side effects.
4. The reducer must not mutate infrastructure state.
5. The reducer may only produce side-effect intent via `effects`.
6. The reducer may emit zero or more `machineEvents`.

---

# 11. Initialization

The engine exposes an initialization operation.

```ts
type InitializeExecution = (
  definition: Definition,
  input: unknown,
  meta?: Partial<ExecutionMeta>
) => Execution;
```

Behavior:

- set `status = READY`,
- set `stateName = definition.startAt`,
- set `frame = { kind: "STATE" }`,
- set `data.input = input`,
- set `data.current = input`,
- set `meta.version = 0`.

---

# 12. State Semantics

This section describes generic ASL semantics, not AWS APIs.

---

## 12.1 Pass

A `Pass` state produces transformed or passthrough output and transitions immediately.

Expected reducer behavior:

- on `START` or `CONTINUE`, compute next payload,
- emit `StateEntered`,
- emit `StateExited`,
- transition to `Next` or terminal success.

Effects:

- none.

---

## 12.2 Task

A `Task` state represents externally executed work.

Expected reducer behavior on `START` or `CONTINUE`:

- emit `StateEntered`,
- transition execution to `WAITING`,
- set `frame = TASK`,
- emit one `INVOKE_TASK` effect.

Expected reducer behavior on `TASK_SUCCEEDED`:

- clear task frame,
- compute next payload,
- apply success transition,
- emit `StateExited`.

Expected reducer behavior on `TASK_FAILED`:

- apply retry/catch semantics if configured,
- otherwise fail or transition through catch,
- emit `StateExited` where semantically appropriate.

Effects:

- `INVOKE_TASK`

---

## 12.3 Choice

A `Choice` state evaluates conditions and chooses the next state.

Expected reducer behavior:

- emit `StateEntered`,
- evaluate rules using current data,
- transition to selected next state or default,
- emit `StateExited`.

Effects:

- none.

---

## 12.4 Wait

A `Wait` state pauses execution until a time or duration condition is satisfied.

Expected reducer behavior on `START` or `CONTINUE`:

- emit `StateEntered`,
- transition execution to `WAITING`,
- set `frame = WAIT`,
- emit `SCHEDULE_WAKE`.

Expected reducer behavior on `WAKE`:

- clear wait frame,
- emit `StateExited`,
- transition to next state.

Effects:

- `SCHEDULE_WAKE`

Important:

- The core does not sleep.
- Waiting is modeled as explicit suspended state.

---

## 12.5 Succeed

A `Succeed` state ends the execution successfully.

Expected reducer behavior:

- emit `StateEntered`,
- emit `StateExited`,
- emit `ExecutionSucceeded`,
- set terminal success state.

Effects:

- none.

---

## 12.6 Fail

A `Fail` state ends the execution in failure.

Expected reducer behavior:

- emit `StateEntered`,
- emit `ExecutionFailed`,
- set terminal failure state.

Effects:

- none.

---

## 12.7 Parallel

A `Parallel` state coordinates multiple child branches.

Expected reducer behavior on `START` or `CONTINUE`:

- emit `StateEntered`,
- create a `ParallelFrame`,
- mark execution as `WAITING`,
- emit one `START_BRANCH` effect per branch.

Expected reducer behavior on `BRANCH_COMPLETED`:

- update the relevant branch status,
- when all branches succeed:
  - aggregate branch results,
  - clear frame,
  - emit `StateExited`,
  - transition to next state.

Expected reducer behavior on `BRANCH_FAILED`:

- apply failure policy, retry, catch, or fail semantics.

Important:

- The parent reducer does not directly execute child branches.
- Child execution scheduling belongs to the runtime.

---

## 12.8 Map

A `Map` state coordinates multiple item executions.

Expected reducer behavior on `START` or `CONTINUE`:

- emit `StateEntered`,
- create a `MapFrame`,
- mark execution as `WAITING`,
- emit `START_MAP_ITEM` effects based on selected items and policy.

Expected reducer behavior on `MAP_ITEM_COMPLETED` / `MAP_ITEM_FAILED`:

- update map progress,
- when join condition is satisfied, emit `StateExited` and transition.

Important:

- Concurrency policy may be partly defined by ASL (`MaxConcurrency`) but execution scheduling remains a runtime concern.

---

# 13. Retry and Catch

Retry and catch are ASL semantics and belong to the core engine.

## 13.1 Retry

Retry logic must:

- live in execution state or frame data,
- be deterministic,
- not depend on hidden call stack.

The reducer may:

- increment attempt count,
- emit a new effect,
- remain in `WAITING`,
- or transition as defined.

## 13.2 Catch

Catch logic must:

- transform failure into a transition to another state,
- preserve error/cause as defined by ASL,
- make resulting transition explicit in execution state.

## 13.3 History Projection

Retry does not require a special internal magic structure in history.
It may appear as repeated task failure/success lifecycle.

---

# 14. Runtime / Driver Responsibilities

The runtime wraps the reducer.

---

## 14.1 Driver Interface

```ts
interface ExecutionDriver {
  dispatch(executionId: string, action: ExecutionAction): Promise<ReduceResult>;
  runEffect(executionId: string, effectId: string): Promise<void>;
  resume(executionId: string): Promise<void>;
}
```

---

## 14.2 Dispatch Flow

`dispatch(executionId, action)` must:

1. load current execution,
2. call `reduce(current, action)`,
3. persist next execution,
4. persist transition record,
5. persist emitted effects as effect records,
6. append machine-event-derived history if enabled.

---

## 14.3 Effect Execution Flow

`runEffect(executionId, effectId)` must:

1. load the effect record,
2. mark effect lifecycle state,
3. emit runtime events,
4. execute the effect through an adapter,
5. translate outcome into follow-up action,
6. dispatch that follow-up action.

---

## 14.4 Waiting Semantics

The reducer never blocks.
Waiting is represented in execution state.
The runtime may:

- poll,
- schedule,
- subscribe,
- callback,
- or allow manual continuation.

---

# 15. Persistence Abstractions

The core must not depend on persistence implementation.

---

## 15.1 Store Interface

```ts
interface ExecutionStore {
  getExecution(executionId: string): Promise<Execution>;
  putExecution(execution: Execution): Promise<void>;

  appendTransition(record: ExecutionTransitionRecord): Promise<void>;

  putEffect(record: EffectRecord): Promise<void>;
  getEffect(executionId: string, effectId: string): Promise<EffectRecord | null>;
  listPendingEffects(executionId: string): Promise<EffectRecord[]>;

  appendHistory(executionId: string, events: ExecutionHistoryEvent[]): Promise<void>;
  nextHistoryId(executionId: string): Promise<number>;
}
```

---

## 15.2 Effect Record

```ts
type EffectStatus = 'EMITTED' | 'DISPATCHED' | 'STARTED' | 'SUCCEEDED' | 'FAILED';

type EffectRecord = {
  executionId: string;
  effect: ExecutionEffect;
  status: EffectStatus;
  result?: unknown;
  failure?: ExecutionFailure;
};
```

---

## 15.3 Transition Record

```ts
type ExecutionTransitionRecord = {
  executionId: string;
  seq: number;
  action: ExecutionAction;
  before: Execution;
  after: Execution;
  effects: ExecutionEffect[];
  machineEvents: ExecutionMachineEvent[];
  createdAt: string;
};
```

Notes:

- This record is the technical truth of one step.
- It is suitable for replay, debugging, and diffing.

---

# 16. Resume Model

Resume is a runtime concern.

---

## 16.1 Principle

The engine does not “resume a function”.
The runtime restores an `Execution` and continues by dispatching actions.

---

## 16.2 Resume Contract

`resume(executionId)` must:

1. load the latest execution,
2. load pending effect records,
3. decide which effects must be:
   - redriven,
   - reattached,
   - ignored as already complete,
   - awaited,
4. continue dispatching follow-up actions as effect outcomes arrive.

---

## 16.3 Resume Safety

Safe resume requires effect status tracking.
The runtime must know whether an effect has:

- only been emitted,
- been dispatched,
- started,
- succeeded,
- failed.

This enables idempotent or policy-based redrive.

---

# 17. Replay Model

Replay is the ability to reconstruct execution state from recorded transitions.

---

## 17.1 Replay Sources

Replay may be driven from:

- full transition records,
- action log + checkpoints,
- snapshots + subsequent transitions.

---

## 17.2 Determinism Rule

Replay is valid only if all non-deterministic inputs are externalized and recorded.

Examples of values that must not be generated inside the reducer:

- current time,
- random values,
- generated IDs used by logic,
- external service responses.

These must instead enter as:

- actions,
- effect results,
- runtime-supplied deterministic inputs.

---

## 17.3 Checkpoints

A runtime may persist:

- every execution version,
- periodic snapshots,
- or only transition records.

The core does not prescribe a storage strategy.

---

# 18. History Model

History is a projection layer, not the engine’s source of truth.

---

## 18.1 Generic History Event

```ts
type HistoryEventBase<TType extends string, TDetails> = {
  id: number;
  previousEventId: number;
  timestamp: string;
  type: TType;
  details: TDetails;
};
```

---

## 18.2 Generic Internal Families

### Machine-derived

- `ExecutionStarted`
- `StateEntered`
- `StateExited`
- `ExecutionSucceeded`
- `ExecutionFailed`

### Runtime-derived

- `TaskScheduled`
- `TaskStarted`
- `TaskSucceeded`
- `TaskFailed`
- `BranchStarted`
- `BranchCompleted`
- `WakeScheduled`
- `WakeDelivered`

---

## 18.3 AWS-Compatible Projection

An AWS compatibility layer may project generic events into AWS-like history names, including:

- `PassStateEntered`
- `PassStateExited`
- `TaskStateEntered`
- `TaskStateExited`
- `ChoiceStateEntered`
- `ChoiceStateExited`
- `LambdaFunctionScheduled`
- `LambdaFunctionStarted`
- `LambdaFunctionSucceeded`
- `ActivityScheduled`
- `MapRunStarted`
- etc.

Important:

- these names belong to the AWS compatibility adapter,
- not the generic engine core.

---

# 19. AWS vs Generic ASL Separation

This is a core architectural requirement.

---

## 19.1 Generic ASL / State-Machine Concepts

These belong in the engine core:

- Definition
- State types defined by ASL semantics
- Execution
- ExecutionControl
- ExecutionData
- ExecutionFrame
- ExecutionAction
- ExecutionEffect
- retry/catch behavior
- state transitions
- map/parallel orchestration semantics
- generic machine events

---

## 19.2 AWS-Specific Concepts

These must be outside the core:

- execution ARN shape
- IAM role semantics
- Lambda-specific event names
- Activity-specific transport APIs
- AWS API payloads
- CloudWatch integration
- service integration wrappers
- `GetExecutionHistory` response shapes
- AWS history event naming taxonomies
- AWS-specific truncation wrappers if required by API compatibility

---

## 19.3 Adapter Boundary

The adapter boundary should look like:

```text
Generic Engine
  -> generic effects/events/state
AWS Adapter
  -> AWS API models
  -> AWS resource execution
  -> AWS history projection
```

This separation enables:

- non-AWS runtimes,
- alternative integrations,
- local test runtimes,
- custom orchestration environments.

---

# 20. Suggested Module Layout

```text
v2/
  core/
    definition.ts
    execution.ts
    control.ts
    data.ts
    frame.ts
    action.ts
    effect.ts
    event.ts
    reducer.ts
    initialize.ts

  runtime/
    driver.ts
    store.ts
    effects.ts
    resume.ts
    replay.ts

  history/
    history-event.ts
    projector.ts
    machine-projector.ts
    runtime-projector.ts

  adapters/
    aws/
      api/
      history/
      task-integration/
      model-mappers/
    test/
      in-memory-store.ts
      fake-task-runner.ts
```

---

# 21. Example Flows

---

## 21.1 Simple Task Flow

```ts
const e0 = initialize(definition, input);
await store.putExecution(e0);

const r1 = await driver.dispatch(e0.id, { type: 'START' });
// execution -> WAITING(TASK)
// effects -> [INVOKE_TASK]

await driver.runEffect(e0.id, r1.effects[0].effectId);
// runtime emits TaskScheduled/TaskStarted
// runtime invokes task
// runtime dispatches TASK_SUCCEEDED or TASK_FAILED
```

---

## 21.2 Parallel Flow

```ts
const r1 = await driver.dispatch(execId, { type: 'START' });
// effects -> START_BRANCH x N
// execution -> WAITING(PARALLEL)

for (const fx of r1.effects) {
  await driver.runEffect(execId, fx.effectId);
}

// child executions complete independently

await driver.dispatch(execId, {
  type: 'BRANCH_COMPLETED',
  branchId: '0',
  result: 'A',
});

await driver.dispatch(execId, {
  type: 'BRANCH_COMPLETED',
  branchId: '1',
  result: 'B',
});
```

---

## 21.3 Resume Flow

```ts
await driver.resume(execId);
```

Runtime behavior:

- load execution,
- inspect pending effects,
- redrive/reconcile as policy allows,
- continue dispatching result actions.

---

# 22. Migration Intent from V1

V1 is primarily:

- in-memory,
- recursive / loop-driven,
- context-mutating,
- run-to-completion.

V2 transitions toward:

- explicit execution state,
- reducer-driven transitions,
- effect-driven runtime orchestration,
- persisted transition records,
- resumability and replay.

A compatibility wrapper may still provide:

- `runToCompletion(...)`
- `runUntilWaiting(...)`
- `runSteps(...)`

These wrappers belong outside the core reducer.

---

# 23. Minimum Viable V2 Scope

Recommended first implementation scope:

## Phase 1

- Pass
- Task
- Succeed
- Fail
- execution initialization
- reducer contract
- transition record persistence
- task effect runtime
- resume for pending task effects
- generic history projection

## Phase 2

- Choice
- Wait

## Phase 3

- Parallel

## Phase 4

- Map

## Phase 5

- refined retry/catch
- AWS compatibility projection parity
- checkpoint optimizations
- variable assignment / modern schema coverage

---

# 24. Final Summary

V2 defines a state machine engine in which:

- **Execution** is the canonical serializable state.
- **Actions** are the only way the core advances.
- **Effects** are declarative requests to the runtime.
- **The reducer is pure and deterministic** given execution + action.
- **Runtime handles orchestration**, not the core.
- **History is projected**, not the execution source of truth.
- **AWS compatibility is an adapter**, not the core model.
- **Resume and replay are first-class** because continuation is explicit in data.

---

# Appendices for V2 Specification

---

# Appendix A — Core Execution Flow Diagrams

## A.1 High-Level Architecture

```text
                        +----------------------+
                        |      Definition      |
                        |   (ASL / generic)    |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |  initialize()        |
                        |  -> Execution        |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |   reduce(execution,  |
                        |          action)     |
                        +-----+-----------+----+
                              |           |
                              |           |
                              v           v
                    +----------------+   +-------------------+
                    | Next Execution |   | Declared Effects  |
                    +----------------+   +-------------------+
                              |                     |
                              |                     v
                              |           +-------------------+
                              |           | Runtime / Driver  |
                              |           | executes effects  |
                              |           +---------+---------+
                              |                     |
                              |                     v
                              |           +-------------------+
                              |           | External systems  |
                              |           | task/timer/child  |
                              |           +---------+---------+
                              |                     |
                              +---------------------+
                                                    |
                                                    v
                                               new Action
                                                    |
                                                    v
                                                reduce(...)
```

---

## A.2 Single-Step Flow

```text
Execution(before) + Action
          |
          v
+---------------------------+
| reduce(execution, action) |
+-------------+-------------+
              |
      +-------+--------+
      |                |
      v                v
Execution(after)   Effects[]
      |
      v
TransitionRecord
```

---

## A.3 Runtime-Orchestrated Flow

```text
dispatch(action)
    |
    v
load execution
    |
    v
reduce(execution, action)
    |
    +--> persist execution(after)
    +--> persist transition record
    +--> persist emitted effects
    +--> append machine-derived history
    |
    v
return ReduceResult

later...

runEffect(effectId)
    |
    +--> append runtime history (scheduled/started/...)
    +--> execute external work
    +--> append runtime history (succeeded/failed)
    +--> dispatch(follow-up action)
```

---

# Appendix B — Task Flow Diagrams

## B.1 Generic Task Flow

```text
Initial Execution
- status = READY
- stateName = "DoWork"
- frame = STATE

        |
        | Action: START
        v

reduce(...)
        |
        +--> execution:
        |    - status = WAITING
        |    - stateName = "DoWork"
        |    - frame = TASK(effectId=fx-1)
        |
        +--> effects:
             - INVOKE_TASK(effectId=fx-1, ...)

        |
        | runtime executes effect fx-1
        v

runtime events:
- TaskScheduled
- TaskStarted
- TaskSucceeded(output=...)

        |
        | runtime dispatches follow-up action
        v

Action: TASK_SUCCEEDED(effectId=fx-1, result=...)

        |
        v

reduce(...)
        |
        +--> execution:
             - next state or terminal success
```

---

## B.2 Task Flow With Failure

```text
START
  |
  v
reduce(...)
  |
  +--> WAITING(TASK)
  +--> INVOKE_TASK(fx-1)

runEffect(fx-1)
  |
  +--> TaskScheduled
  +--> TaskStarted
  +--> TaskFailed(error, cause)
  +--> dispatch(TASK_FAILED)

reduce(... TASK_FAILED ...)
  |
  +--> retry?    -> WAITING(TASK, attempt+1) + INVOKE_TASK(fx-2)
  +--> catch?    -> transition to catcher state
  +--> otherwise -> FAILED
```

---

# Appendix C — Parallel Flow Diagrams

## C.1 Parent + Branch Model

```text
Parent Execution
- stateName = "DoParallel"
- frame = STATE

        |
        | Action: CONTINUE
        v

reduce(parent, CONTINUE)
        |
        +--> parent execution:
        |    - status = WAITING
        |    - frame = PARALLEL
        |    - branches = [0:PENDING, 1:PENDING, 2:PENDING]
        |
        +--> effects:
             - START_BRANCH(0)
             - START_BRANCH(1)
             - START_BRANCH(2)
```

---

## C.2 Runtime Coordination

```text
Effects from parent:
- START_BRANCH 0
- START_BRANCH 1
- START_BRANCH 2

         |
         v

+-----------------------------+
| Runtime creates/runs child  |
| executions independently    |
+-----------------------------+

 child-0 -> completes with "A"
 child-1 -> completes with "B"
 child-2 -> completes with "C"

         |
         v

dispatch(parent, BRANCH_COMPLETED(0, "A"))
dispatch(parent, BRANCH_COMPLETED(1, "B"))
dispatch(parent, BRANCH_COMPLETED(2, "C"))

         |
         v

reduce(parent, ...)
         |
         +--> when all branches completed:
              - aggregate results ["A", "B", "C"]
              - clear PARALLEL frame
              - transition to next state
```

---

## C.3 Important Concurrency Rule

```text
Branches may run concurrently.
Parent state must still be reduced sequentially.

Correct:
  p2 = reduce(p1, BRANCH_COMPLETED(0))
  p3 = reduce(p2, BRANCH_COMPLETED(1))

Not correct:
  p2 = reduce(p1, BRANCH_COMPLETED(0))
  p3 = reduce(p1, BRANCH_COMPLETED(1))
```

---

# Appendix D — Resume and Replay Diagrams

## D.1 Resume From Latest Persisted State

```text
+----------------------+
| Stored Execution     |
| status = WAITING     |
| frame  = TASK/WAIT   |
+----------+-----------+
           |
           v
+----------------------+
| listPendingEffects() |
+----------+-----------+
           |
    +------+------+
    |             |
    v             v
 no pending    pending effects
 effects           |
    |              v
    |        redrive / reattach
    |              |
    +--------------+
           |
           v
 wait for or produce follow-up action
           |
           v
 dispatch(action)
           |
           v
 reduce(...)
```

---

## D.2 Replay Model

```text
Execution(initial)
      |
      v
 Action #1 ---> reduce ---> Execution #1
      |
      v
 Action #2 ---> reduce ---> Execution #2
      |
      v
 Action #3 ---> reduce ---> Execution #3
```

Replay requires:

- deterministic reducer
- recorded external outcomes
- no hidden time/random/IO inside reducer

---

## D.3 Replay With Checkpoints

```text
Checkpoint at version 50
        |
        v
Execution #50
        |
        +--> Action #51 -> reduce -> Execution #51
        +--> Action #52 -> reduce -> Execution #52
        +--> Action #53 -> reduce -> Execution #53
```

---

# Appendix E — Minimal Interfaces

These are intentionally light and storage-agnostic.

---

## E.1 Core Engine

```ts
export interface Engine {
  initialize(definition: Definition, input: unknown, meta?: Partial<ExecutionMeta>): Execution;

  reduce(execution: Execution, action: ExecutionAction): ReduceResult;
}
```

---

## E.2 Driver

```ts
export interface ExecutionDriver {
  dispatch(executionId: string, action: ExecutionAction): Promise<ReduceResult>;

  runEffect(executionId: string, effectId: string): Promise<void>;

  resume(executionId: string): Promise<void>;
}
```

---

## E.3 Store

```ts
export interface ExecutionStore {
  getExecution(executionId: string): Promise<Execution>;
  putExecution(execution: Execution): Promise<void>;

  appendTransition(record: ExecutionTransitionRecord): Promise<void>;

  putEffect(record: EffectRecord): Promise<void>;
  getEffect(executionId: string, effectId: string): Promise<EffectRecord | null>;
  listPendingEffects(executionId: string): Promise<EffectRecord[]>;

  appendHistory(executionId: string, events: ExecutionHistoryEvent[]): Promise<void>;

  nextHistoryId(executionId: string): Promise<number>;
}
```

---

## E.4 Task Port

```ts
export interface TaskPort {
  invoke(input: {
    effectId: string;
    resourceType?: string;
    resource: string;
    input: unknown;
  }): Promise<unknown>;
}
```

---

## E.5 Runtime Ports

```ts
export interface RuntimePorts {
  tasks?: TaskPort;

  clock?: {
    now(): Promise<string>;
  };

  scheduler?: {
    scheduleWake(input: { effectId: string; executionId: string; at: string }): Promise<void>;
  };

  childExecutions?: {
    startBranch(input: {
      parentExecutionId: string;
      branchId: string;
      definition: Definition;
      input: unknown;
    }): Promise<void>;
  };
}
```

---

# Appendix F — Generic Coding Examples

---

## F.1 Generic Non-AWS Task Example

### Definition

```ts
const definition: Definition = {
  startAt: 'Normalize',
  states: {
    Normalize: {
      type: 'Task',
      resourceType: 'custom',
      resource: 'normalize-user-input',
      next: 'Done',
    },
    Done: {
      type: 'Succeed',
    },
  },
};
```

### Runtime usage

```ts
const e0 = engine.initialize(definition, { name: '  Gabriel  ' });
await store.putExecution(e0);

const r1 = await driver.dispatch(e0.id, { type: 'START' });
// r1.effects = [{ type: "INVOKE_TASK", resourceType: "custom", resource: "normalize-user-input", ... }]

await driver.runEffect(e0.id, r1.effects[0].effectId);
```

### Generic task adapter

```ts
const ports: RuntimePorts = {
  tasks: {
    async invoke({ resource, input }) {
      if (resource === 'normalize-user-input') {
        const payload = input as { name: string };
        return { name: payload.name.trim() };
      }
      throw new Error(`Unknown resource ${resource}`);
    },
  },
};
```

---

## F.2 Generic Parallel Example

```ts
const branchA: Definition = {
  startAt: 'A',
  states: {
    A: { type: 'Pass', result: 'A', end: true },
  },
};

const branchB: Definition = {
  startAt: 'B',
  states: {
    B: { type: 'Pass', result: 'B', end: true },
  },
};

const definition: Definition = {
  startAt: 'P',
  states: {
    P: {
      type: 'Parallel',
      branches: [branchA, branchB],
      next: 'Done',
    },
    Done: {
      type: 'Succeed',
    },
  },
};

const e0 = engine.initialize(definition, {});
await store.putExecution(e0);

const r1 = await driver.dispatch(e0.id, { type: 'START' });
// effects: START_BRANCH x2

// later, after child execution runtime completes:
await driver.dispatch(e0.id, {
  type: 'BRANCH_COMPLETED',
  branchId: '0',
  result: 'A',
});

await driver.dispatch(e0.id, {
  type: 'BRANCH_COMPLETED',
  branchId: '1',
  result: 'B',
});
```

---

# Appendix G — AWS-Oriented Coding Examples

These examples show how AWS-specific concerns are adapters, not core concepts.

---

## G.1 AWS Task Adapter

### Generic effect from core

```ts
{
  type: "INVOKE_TASK",
  effectId: "fx-1",
  stateName: "CallLambda",
  resourceType: "lambda",
  resource: "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
  input: { who: "Step Functions" }
}
```

### AWS adapter implementation

```ts
const awsPorts: RuntimePorts = {
  tasks: {
    async invoke({ resourceType, resource, input }) {
      if (resourceType === 'lambda') {
        return invokeLambda(resource, input);
      }

      if (resourceType === 'activity') {
        return waitForActivityCompletion(resource, input);
      }

      if (resourceType === 'aws-sdk') {
        return invokeAwsSdkIntegration(resource, input);
      }

      throw new Error(`Unsupported AWS resourceType: ${resourceType}`);
    },
  },
};
```

---

## G.2 AWS-Compatible History Projection

### Generic runtime events

```ts
[
  {
    type: 'TaskScheduled',
    effectId: 'fx-1',
    stateName: 'HelloWorld',
    resourceType: 'lambda',
    resource: 'arn:aws:lambda:us-east-1:123:function:HelloWorld',
    input: { who: 'Step Functions' },
  },
  {
    type: 'TaskStarted',
    effectId: 'fx-1',
    stateName: 'HelloWorld',
    resourceType: 'lambda',
    resource: 'arn:aws:lambda:us-east-1:123:function:HelloWorld',
  },
  {
    type: 'TaskSucceeded',
    effectId: 'fx-1',
    stateName: 'HelloWorld',
    output: 'Hello, Step Functions!',
  },
];
```

### AWS projection

```ts
[
  {
    id: 3,
    previousEventId: 2,
    timestamp: '2026-04-15T15:00:00.000Z',
    type: 'LambdaFunctionScheduled',
    lambdaFunctionScheduledEventDetails: {
      input: '{"who":"Step Functions"}',
      resource: 'arn:aws:lambda:us-east-1:123:function:HelloWorld',
    },
  },
  {
    id: 4,
    previousEventId: 3,
    timestamp: '2026-04-15T15:00:00.050Z',
    type: 'LambdaFunctionStarted',
  },
  {
    id: 5,
    previousEventId: 4,
    timestamp: '2026-04-15T15:00:00.200Z',
    type: 'LambdaFunctionSucceeded',
    lambdaFunctionSucceededEventDetails: {
      output: '"Hello, Step Functions!"',
    },
  },
];
```

Important:

- the core did not know `LambdaFunctionScheduled`
- the AWS projector created it

---

## G.3 AWS-Compatible APIs as Adapters

```ts
export interface AwsStepFunctionsAdapter {
  startExecution(input: { stateMachineArn: string; input: string; name?: string }): Promise<{
    executionArn: string;
    startDate: string;
  }>;

  describeExecution(input: { executionArn: string }): Promise<{
    executionArn: string;
    stateMachineArn: string;
    status: string;
    input: string;
    output?: string;
    startDate: string;
    stopDate?: string;
  }>;

  getExecutionHistory(input: { executionArn: string }): Promise<{
    events: unknown[];
  }>;
}
```

The adapter maps:

- AWS request model -> generic engine/driver calls
- generic history -> AWS history response shape

---

# Appendix H — History Event Examples

---

## H.1 Generic Internal History Example

```ts
[
  {
    id: 1,
    previousEventId: 0,
    timestamp: '2026-04-15T15:00:00.000Z',
    type: 'ExecutionStarted',
    details: {
      input: { who: 'Gabriel' },
    },
  },
  {
    id: 2,
    previousEventId: 1,
    timestamp: '2026-04-15T15:00:00.001Z',
    type: 'StateEntered',
    details: {
      stateName: 'DoWork',
      stateType: 'Task',
      input: { who: 'Gabriel' },
    },
  },
  {
    id: 3,
    previousEventId: 2,
    timestamp: '2026-04-15T15:00:00.002Z',
    type: 'TaskScheduled',
    details: {
      effectId: 'fx-1',
      resourceType: 'custom',
      resource: 'hello-service',
      input: { who: 'Gabriel' },
    },
  },
  {
    id: 4,
    previousEventId: 3,
    timestamp: '2026-04-15T15:00:00.003Z',
    type: 'TaskStarted',
    details: {
      effectId: 'fx-1',
    },
  },
  {
    id: 5,
    previousEventId: 4,
    timestamp: '2026-04-15T15:00:00.050Z',
    type: 'TaskSucceeded',
    details: {
      effectId: 'fx-1',
      output: { greeting: 'Hello Gabriel' },
    },
  },
  {
    id: 6,
    previousEventId: 5,
    timestamp: '2026-04-15T15:00:00.051Z',
    type: 'StateExited',
    details: {
      stateName: 'DoWork',
      stateType: 'Task',
      output: { greeting: 'Hello Gabriel' },
    },
  },
  {
    id: 7,
    previousEventId: 6,
    timestamp: '2026-04-15T15:00:00.052Z',
    type: 'ExecutionSucceeded',
    details: {
      output: { greeting: 'Hello Gabriel' },
    },
  },
];
```

---

## H.2 AWS-Compatible History Example

```ts
[
  {
    id: 1,
    previousEventId: 0,
    timestamp: '2026-04-15T15:00:00.000Z',
    type: 'ExecutionStarted',
    executionStartedEventDetails: {
      input: '{"who":"Gabriel"}',
      roleArn: 'arn:aws:iam::123456789012:role/StateMachineRole',
    },
  },
  {
    id: 2,
    previousEventId: 1,
    timestamp: '2026-04-15T15:00:00.001Z',
    type: 'TaskStateEntered',
    stateEnteredEventDetails: {
      name: 'DoWork',
      input: '{"who":"Gabriel"}',
    },
  },
  {
    id: 3,
    previousEventId: 2,
    timestamp: '2026-04-15T15:00:00.002Z',
    type: 'LambdaFunctionScheduled',
    lambdaFunctionScheduledEventDetails: {
      input: '{"who":"Gabriel"}',
      resource: 'arn:aws:lambda:us-east-1:123456789012:function:HelloFunction',
    },
  },
  {
    id: 4,
    previousEventId: 3,
    timestamp: '2026-04-15T15:00:00.003Z',
    type: 'LambdaFunctionStarted',
  },
  {
    id: 5,
    previousEventId: 4,
    timestamp: '2026-04-15T15:00:00.050Z',
    type: 'LambdaFunctionSucceeded',
    lambdaFunctionSucceededEventDetails: {
      output: '"Hello Gabriel"',
    },
  },
  {
    id: 6,
    previousEventId: 5,
    timestamp: '2026-04-15T15:00:00.051Z',
    type: 'TaskStateExited',
    stateExitedEventDetails: {
      name: 'DoWork',
      output: '"Hello Gabriel"',
    },
  },
  {
    id: 7,
    previousEventId: 6,
    timestamp: '2026-04-15T15:00:00.052Z',
    type: 'ExecutionSucceeded',
    executionSucceededEventDetails: {
      output: '"Hello Gabriel"',
    },
  },
];
```

---

# Appendix I — Minimal Resume Example

## I.1 Resume Interface

```ts
export interface Resumer {
  resume(executionId: string): Promise<void>;
}
```

---

## I.2 Resume Logic Sketch

```ts
async function resume(
  executionId: string,
  store: ExecutionStore,
  driver: ExecutionDriver
): Promise<void> {
  const execution = await store.getExecution(executionId);
  const pending = await store.listPendingEffects(executionId);

  if (execution.control.status !== 'WAITING') {
    return;
  }

  for (const record of pending) {
    switch (record.status) {
      case 'EMITTED':
      case 'DISPATCHED':
      case 'STARTED':
        await driver.runEffect(executionId, record.effect.effectId);
        break;

      case 'SUCCEEDED':
      case 'FAILED':
        // already terminal at effect level; runtime-specific reconciliation may apply
        break;
    }
  }
}
```

---

## I.3 Resume Diagram

```text
persisted execution
- status = WAITING
- frame = TASK(effectId=fx-1)

persisted effects
- fx-1 status = STARTED

        |
        v

resume(executionId)
        |
        +--> load execution
        +--> list pending effects
        +--> redrive / reattach fx-1
        +--> when result arrives:
               dispatch(TASK_SUCCEEDED or TASK_FAILED)
        |
        v
reduce(...)
```

---

# Appendix J — Suggested Primordial Principles

These principles should remain stable even if implementation details evolve.

1. **The reducer is pure.**
2. **The runtime owns orchestration.**
3. **Execution state is explicit and serializable.**
4. **Effects are declared, not performed, by the core.**
5. **All external outcomes re-enter as actions.**
6. **History is projected, not the source of truth.**
7. **AWS compatibility is an adapter, not the engine.**
8. **Continuation lives in data, not in stack.**
9. **Parallel child execution may be concurrent, but parent reduction remains sequential.**
10. **Resume means restoring execution state, not resuming a suspended function.**

---
