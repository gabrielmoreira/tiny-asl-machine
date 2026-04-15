# ASL Compatibility

This document explains how close Tiny ASL Machine is to AWS Step Functions today.

It is a **practical compatibility guide**, not a promise of full AWS parity.

If you need the final answer to "does AWS behave like this?", use the AWS-backed conformance tests.

## Quick summary

Tiny ASL Machine is strong for:

- local testing of Step Functions logic
- JSONPath-style dataflow
- `Catch` / `Retry` flows used in normal orchestration
- intrinsic functions
- modern JSONata-based authoring
- `Map` and `Parallel` workflows with mocked resources

Tiny ASL Machine is **not** a full local copy of AWS Step Functions.

The biggest known limits are:

- advanced distributed `Map` / `ItemReader` cases
- local Parquet decoding
- full callback / task-token fidelity
- durable execution / pause-resume behavior
- service-level AWS integration behavior

## Current support by area

| Area                                      | Status       | Notes                                                                                                                   |
| ----------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Core states                               | Very strong  | `Task`, `Pass`, `Choice`, `Wait`, `Parallel`, `Map`, `Succeed`, and `Fail` are available for local execution.           |
| Dataflow                                  | Very strong  | `InputPath`, `OutputPath`, `ResultPath`, `Parameters`, and `ResultSelector` are covered well for normal workflow tests. |
| Error handling                            | Very strong  | `Catch` and `Retry` work for common orchestration patterns. AWS is still the final check for edge cases.                |
| Intrinsics                                | Very strong  | Broad JSONPath intrinsic coverage is available for transformation-heavy workflows.                                      |
| JSONata                                   | Very strong  | JSONata-based conditions, output shaping, and related execution flow have strong coverage.                              |
| Validation coverage                       | Good         | A large set of structure and behavior checks exists, but some validation is still AWS-only by design.                   |
| Advanced distributed `Map` / `ItemReader` | Partial      | Common local cases work. More advanced manifest-driven and service-coupled cases are still limited locally.             |
| Callback / task-token flows               | Partial      | Some related plumbing exists, but full callback fidelity is not complete.                                               |
| Persistence / durable execution           | Out of scope | This package is for testing workflow logic, not for running durable production workflows.                               |

## Conformance coverage snapshot

The project has a large compatibility test suite.

Current snapshot from the conformance case files:

- about **946 conformance cases**
- across **79 groups**
- about **12 cases per group on average**

Approximate case count by area:

| Area                               | Approx. case count |
| ---------------------------------- | -----------------: |
| Intrinsic functions                |                404 |
| Feature / integration-style groups |                257 |
| Choice operator groups             |                188 |
| Classic state suites               |                 47 |
| Observation groups                 |                 27 |
| Validation groups                  |                 23 |

Examples of larger groups today:

- `Feature.JSONataBuiltins` — 46 cases
- `States.MathAdd` — 36 cases
- `States.Hash` — 31 cases
- `Feature.MapErrors` — 28 cases
- `States.MathRandom` — 28 cases
- `Observation.ItemReader` — 27 cases

That does **not** mean every Step Functions feature is finished.

It does mean the project has already invested heavily in compatibility testing, especially in the areas that matter most for real workflow logic.

## What the compatibility tests actually do

The compatibility suite has two runners:

### 1. Local conformance

The local runner:

- loads one conformance case
- runs it through Tiny ASL Machine
- uses mocked local resources when needed
- captures either output or error
- checks that result against the expected behavior

In code, that is mainly wired through:

- `tests/conformance.spec.ts`
- `tests/conformance/support/runLocalCase.ts`

Local conformance is best for:

- fast feedback
- everyday logic checks
- payload shaping
- branching behavior
- mocked task-resource behavior

### 2. AWS-backed conformance

The AWS runner:

- validates the state machine definition with AWS
- creates a temporary state machine in Step Functions
- starts one execution with the case input
- waits for completion
- captures AWS output or AWS error
- compares that result against the expected behavior
- deletes the temporary state machine afterward

In code, that is mainly wired through:

- `tests/conformance.spec.ts`
- `tests/conformance/support/runAwsCase.ts`

AWS-backed conformance is best for:

- parity-sensitive features
- validation behavior
- edge cases where AWS details matter
- cases where local behavior is intentionally guarded or incomplete

## How the conformance suite is organized

Each test case belongs to a **group**.

Examples:

- `Choice.StringEquals`
- `States.MathAdd`
- `Feature.JSONPathPipeline`
- `Feature.JSONataComposition`
- `Validation.BasicStructure`
- `Observation.ItemReader`

The runner groups cases by `group`, then runs each case by `id`.

That gives the project a clean way to track compatibility area by area.

It also makes focused runs easy.

## How to run compatibility tests

### Run the full local suite

```bash
pnpm run test:conformance:local
```

### Run the AWS-backed suite

```bash
pnpm run test:conformance:aws
```

### Run all tests in CI mode

```bash
pnpm run test:ci
```

### Run only one area or one group

Examples:

```bash
pnpm run test:conformance -- --case='group:"Feature.JSONataComposition"'
pnpm run test:conformance -- --case='group:"States.MathAdd"'
pnpm run test:conformance -- --case='id:"006-parquet-versionid-is-unsupported"'
```

The case filter works on fields like:

- `group`
- `id`
- `title`
- `tags`

## How to read the results correctly

A feature can be in one of these states:

### Broadly supported

This means:

- local execution works well for common use
- the behavior is tested enough to trust in everyday workflow tests
- AWS may still differ in some rare edge cases

### Partial

This means:

- useful parts already work
- some shapes, data sources, or edge cases still need AWS checks
- local behavior may be guarded, limited, or incomplete

### Deferred or out of scope

This means the project is not trying to fully model that behavior locally right now.

Usually that is because the feature is:

- very AWS-service-specific
- hard to model locally without fake infrastructure
- outside the package's goal as a testing tool

## Known areas where AWS should still be the authority

Use AWS-backed checks first when you care about:

- advanced `ItemReader` manifests
- Parquet-backed ingestion behavior
- callback / task-token workflows
- exact validation wording and AWS-only validation rules
- service-coupled edge cases
- very new Step Functions features

## Notes on advanced `Map` / `ItemReader`

Local support already covers important non-Parquet cases such as:

- JSON item loading
- `ItemsPointer`
- `MaxItems`
- CSV with supported header modes
- JSONL
- `LOAD_AND_FLATTEN` for supported JSON flows
- `listObjectsV2` observation paths used in current conformance work

But local support is still limited for:

- advanced manifest-driven flows
- some service-coupled ingestion behavior
- full Parquet local decoding

For Parquet, the project currently prefers **clear guardrails** instead of pretending to support full local decoding.

## Bottom line

A fair short summary is:

- Tiny ASL Machine has **high-value local compatibility** for a large part of Step Functions logic
- the project has already done **a lot of conformance work**
- AWS parity is **strong in many areas**, but still **not total**
- for hard edge cases, **AWS-backed conformance is the authority**
