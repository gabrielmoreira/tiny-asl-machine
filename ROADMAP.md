# Tiny ASL Machine — Adaptation Roadmap

> Roadmap for aligning tiny-asl-machine with the current AWS Step Functions ASL specification.
>
> Last analyzed: April 2026 | ASL Spec version: November 2024 | AWS Changelog through: September 2025

## Current State

tiny-asl-machine implements **~75% of the ASL spec** as it existed in mid-2022. Since then, AWS has introduced several major changes to the Amazon States Language and Step Functions service. This roadmap identifies the gaps and prioritizes work to bring the library up to date.

### What We Have Today

| Area | Status | Details |
|------|--------|---------|
| **State Types** | ✅ 8/8 | Pass, Task, Choice, Wait, Parallel, Map, Succeed, Fail |
| **Data Flow** | ✅ Complete | InputPath, OutputPath, ResultPath, Parameters, ResultSelector |
| **Choice Operators** | ✅ ~90% | 28+ operators, logical combinators (And/Or/Not) |
| **Intrinsic Functions** | 🟡 5/19 | Format, StringToJson, JsonToString, Array, ArrayContains |
| **Error Handling** | 🟡 Catch only | Catch ✅, **Retry NOT implemented** |
| **Map State** | 🟡 Basic | Iterator + ItemsPath, no Distributed Map features |
| **Context Object** | 🟡 Partial | Execution, StateMachine, State, Map.Item |
| **JSONata** | ❌ None | No QueryLanguage, no Variables, no Assign |
| **Timeout/Heartbeat** | ❌ Parsed only | Fields accepted but not enforced at runtime |

---

## Tier 0 — Critical Fixes (Core ASL Correctness)

> These are bugs or missing core features that affect the correctness of existing ASL definitions when tested with this library. **Should be addressed first.**

### 0.1 Retry Logic ⭐

**Status:** NOT IMPLEMENTED (TODO in source since day one)
**Impact:** Retry blocks are present in the vast majority of production state machines. Without Retry support, users cannot test retry behavior at all.

**What to implement:**
- Exponential backoff: `interval = IntervalSeconds × (BackoffRate ^ attempt)`
- `MaxAttempts` enforcement (default: 3)
- `BackoffRate` multiplier (default: 2.0)
- `ErrorEquals` matching (same logic as Catch, including `States.ALL`)
- `MaxDelaySeconds` — cap on computed backoff interval (added Sep 2023)
- `JitterStrategy` — jitter on retry intervals (added Sep 2023, e.g. `"FULL"`)
- Retry/Catch interaction: exhaust retries before falling through to Catch

**ASL Spec reference:** Retrying after error section
**Files to modify:** `src/states/index.ts` (~L69, the existing TODO)

### 0.2 Missing String*Path Choice Operators

**Status:** Types are declared but code does not implement them
**Impact:** Any state machine using path-based string comparisons will silently fail

**What to implement:**
- `StringEqualsPath`
- `StringLessThanPath`, `StringGreaterThanPath`
- `StringLessThanEqualsPath`, `StringGreaterThanEqualsPath`

**Files to modify:** `src/choices/operators.ts`

### 0.3 States.ResultPathMatchFailure

**Status:** TODO in source code
**Impact:** When ResultPath cannot be applied, should throw a proper ASL error instead of a generic runtime error

**Files to modify:** `src/states/index.ts` (~L302)

---

## Tier 1 — High Priority (Modern ASL Features in Active Use)

> Features added between 2022-2023 that are commonly used in production state machines today.

### 1.1 Complete Intrinsic Functions (14 missing)

**Added:** August 2022
**Impact:** Many production state machines use these for data manipulation without Lambda calls

| Function | Category | Complexity |
|----------|----------|------------|
| `States.ArrayPartition` | Array | Medium |
| `States.ArrayRange` | Array | Low |
| `States.ArrayGetItem` | Array | Low |
| `States.ArrayLength` | Array | Low |
| `States.ArrayUnique` | Array | Low |
| `States.Base64Encode` | Encoding | Low |
| `States.Base64Decode` | Encoding | Low |
| `States.Hash` | Crypto | Medium (MD5, SHA-1, SHA-256, SHA-384, SHA-512) |
| `States.JsonMerge` | JSON | Medium (shallow + deep merge) |
| `States.MathRandom` | Math | Low (with seed support) |
| `States.MathAdd` | Math | Low |
| `States.StringSplit` | String | Low |
| `States.UUID` | Utility | Low (v4 UUID) |

**Files to modify:** `src/utils/selectPath.ts`, `src/utils/parseIntrinsicFunction.ts`

### 1.2 Map State: ItemProcessor + ItemSelector

**Added:** December 2022
**Impact:** `Iterator` and `Parameters` are **deprecated** in Map state. New state machines use `ItemProcessor` and `ItemSelector`.

**What to implement:**
- Accept `ItemProcessor` as synonym for `Iterator`
- Accept `ItemSelector` as synonym for `Parameters` in Map
- Support `ProcessorConfig` field (at minimum, parse and ignore for INLINE mode)

**Files to modify:** `src/states/index.ts` (Map executor), `types/asl.d.ts`

### 1.3 Fail State: ErrorPath + CausePath

**Added:** September 2023
**Impact:** Production state machines increasingly use dynamic error/cause from input

**What to implement:**
- `ErrorPath` — Reference Path to resolve Error from state input
- `CausePath` — Reference Path to resolve Cause from state input
- Mutual exclusion: cannot have both `Error` and `ErrorPath`, or `Cause` and `CausePath`

**Files to modify:** `src/states/index.ts` (Fail executor), `types/asl.d.ts`

### 1.4 Dynamic Timeout/Heartbeat Paths

**Added:** August 2020
**Impact:** Some state machines compute timeouts dynamically

**What to implement:**
- `TimeoutSecondsPath` — Reference Path resolving to a positive integer
- `HeartbeatSecondsPath` — Reference Path resolving to a positive integer
- Mutual exclusion with fixed-value counterparts

**Note:** This only requires resolving the path; actual timeout enforcement is Tier 3.

**Files to modify:** `src/states/index.ts` (Task executor), `types/asl.d.ts`

### 1.5 Credentials Field on Task State

**Added:** November 2022
**Impact:** Cross-account task execution uses Credentials. For a testing library, parsing and passing through is sufficient.

**What to implement:**
- Accept `Credentials` field on Task state
- Make it available in the resource context so mocks can inspect it

**Files to modify:** `src/states/index.ts` (Task executor), `types/asl.d.ts`, `types/runtime.d.ts`

---

## Tier 2 — Major (JSONata + Variables)

> The biggest spec change since ASL launched. Added November 2024. This is a **transformative** change that introduces a second query language alongside JSONPath.

### 2.1 QueryLanguage Field

**What to implement:**
- Top-level `QueryLanguage` field (default: `"JSONPath"`)
- Per-state `QueryLanguage` override
- When `"JSONPath"`: existing behavior (InputPath, Parameters, ResultSelector, ResultPath, OutputPath)
- When `"JSONata"`: different field set (Arguments, Output, no InputPath/Parameters/ResultSelector/ResultPath/OutputPath)

### 2.2 JSONata Expression Evaluation

**What to implement:**
- Parse `{% expression %}` JSONata strings in any field that accepts JSONata
- Evaluate JSONata expressions using a JSONata library (e.g., `jsonata` npm package)
- `$states.input` — state input
- `$states.result` — state result (Task/Map/Parallel)
- `$states.errorOutput` — Error Output in Catch
- `$states.context` — Context Object
- JSONata runtime errors throw `States.QueryEvaluationError`
- Restrictions: no `$`, `$$`, or unqualified field names at top-level expressions

### 2.3 State Machine Variables + Assign

**What to implement:**
- `Assign` field on any state except Succeed and Fail
- Variable scoping (state-machine-local scope, inner scopes for Parallel branches / Map iterations)
- Variable references via `$variableName` in JSONata expressions
- Assignment semantics: current values during evaluation, new values in next state
- `Assign` on Choice Rules and Catchers

### 2.4 JSONata-Specific State Fields

**What to implement:**
- `Arguments` — replaces Parameters for Task/Parallel (JSONata states)
- `Output` — replaces ResultPath + OutputPath (JSONata states)
- `Items` — replaces ItemsPath for Map (JSONata states)
- `Condition` — replaces Choice Rule comparison operators (JSONata states)

### 2.5 Complexity Assessment

JSONata support is the **single largest feature addition** this library would need. It requires:
- Adding a JSONata evaluation dependency (~`jsonata` npm package)
- Refactoring the state execution pipeline to branch on query language
- Implementing variable scoping across nested state machines
- Extensive testing of both JSONPath and JSONata code paths

**Recommendation:** This should be a dedicated major version (v0.1.0 or v1.0.0) effort.

---

## Tier 3 — Advanced (Distributed Map + Runtime Enforcement)

> Features for complex production patterns. Lower priority for a testing library but important for completeness.

### 3.1 Distributed Map Features

**Added:** December 2022, expanded February 2025 and September 2025
**Impact:** Used for large-scale parallel processing (ETL, data pipelines)

| Feature | Complexity | Notes |
|---------|------------|-------|
| `ItemReader` | High | Read items from external resource (S3, etc.) |
| `ItemBatcher` | Medium | Batch items into sub-arrays |
| `ResultWriter` | Medium | Write results to external resource |
| `ToleratedFailurePercentage` | Low | Allow N% of iterations to fail |
| `ToleratedFailureCount` | Low | Allow N iterations to fail |
| `MaxConcurrencyPath` | Low | Dynamic max concurrency from input |

**Recommendation:** For testing, `ToleratedFailurePercentage/Count` and `MaxConcurrencyPath` are low-hanging fruit. ItemReader/Batcher/ResultWriter require integration hooks similar to how `resourceContext.invoke` works for Tasks.

### 3.2 Timeout + Heartbeat Runtime Enforcement

**What to implement:**
- Actually enforce `TimeoutSeconds` by racing task execution against a timer
- Throw `States.Timeout` when exceeded
- `HeartbeatSeconds` would require a callback mechanism in the resource context

**Note:** For testing, users typically use fake timers (vitest/jest). Consider making enforcement opt-in via a runtime option.

### 3.3 Parallel/Map Branch Failure Improvements

- When any branch/iteration fails, terminate other branches/iterations
- `States.BranchFailed` error propagation
- Better error isolation between branches

---

## Tier 4 — Polish

> Nice-to-have improvements for developer experience.

| Feature | Description |
|---------|-------------|
| **Definition Validation** | Pre-execution validation of state machine definitions (undefined Next states, circular deps, type mismatches) |
| **Context Object Expansion** | More `$$` fields (StartTime, State.EnteredTime, State.RetryCount) |
| **Better Error Messages** | Descriptive errors for common mistakes |
| **CLI Tool** | Analyze state machine JSON and generate typed test stubs |
| **TestState API** | Allow testing individual states in isolation (mirrors AWS TestState API) |

---

## Suggested Release Plan

| Version | Scope | Effort Estimate |
|---------|-------|-----------------|
| **v0.0.12** | Tier 0: Retry logic, String*Path operators, ResultPathMatchFailure | 2-3 days |
| **v0.0.13** | Tier 1.1: Complete all 19 intrinsic functions | 1-2 days |
| **v0.0.14** | Tier 1.2-1.5: ItemProcessor/ItemSelector, Fail ErrorPath/CausePath, dynamic timeouts, Credentials | 2-3 days |
| **v0.1.0** | Tier 2: JSONata + Variables (major feature) | 1-2 weeks |
| **v0.2.0** | Tier 3: Distributed Map hooks, runtime enforcement | 1 week |
| **v1.0.0** | Tier 4 + stabilization, full spec compliance | Ongoing |

---

## Features Intentionally Out of Scope

These AWS Step Functions features are **service-level** features, not ASL interpreter features. They do not affect how state machine definitions execute and are not planned for implementation:

- **AWS SDK Service Integrations** — The library accepts any resource string; mocking handles this
- **HTTPS Endpoint Invocation** — Same as above
- **Amazon Bedrock / SageMaker / EMR integration** — Service-level
- **Redrive (restart from failure point)** — Execution management
- **Versions and Aliases** — Deployment management
- **KMS Encryption** — Security infrastructure
- **IaC Export / Workflow Studio** — Tooling
- **CloudWatch Metrics / X-Ray Tracing** — Observability
- **VPC Endpoints** — Network configuration
- **Express Workflows vs Standard** — Execution mode (both use same ASL)

---

## References

- [ASL Specification](https://states-language.net/spec.html) (Nov 2024 revision)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [AWS Step Functions Changelog](https://docs.aws.amazon.com/step-functions/latest/dg/document-history.html)
- [ASL Feature Launches](https://docs.aws.amazon.com/step-functions/latest/dg/recent-launches.html)
