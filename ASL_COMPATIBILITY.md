# ASL Compatibility

This document explains how close Tiny ASL Machine is to AWS Step Functions today.

It is a practical guide, not a promise of full AWS parity.

If you need the final answer to “does AWS behave like this?”, use the AWS-backed conformance tests.

## Quick summary

Strong areas today:

- local testing of Step Functions logic
- JSONPath-style dataflow
- normal `Catch` / `Retry` orchestration
- intrinsic functions
- modern JSONata-based authoring
- `Map` and `Parallel` workflows with mocked resources or pure ASL structure

Main limits today:

- advanced distributed `Map` / `ItemReader` cases
- local Parquet decoding
- full callback / task-token fidelity
- durable execution / pause-resume behavior
- service-level AWS integration behavior

## Support by area

| Area                                      | Status       | Notes                                                                                                                   |
| ----------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Core states                               | Strong       | `Task`, `Pass`, `Choice`, `Wait`, `Parallel`, `Map`, `Succeed`, and `Fail` are available for local execution.           |
| Dataflow                                  | Strong       | `InputPath`, `OutputPath`, `ResultPath`, `Parameters`, and `ResultSelector` are well covered for normal workflow tests. |
| Error handling                            | Strong       | `Catch` and `Retry` work well for common orchestration patterns. AWS is still the final check for edge cases.           |
| Intrinsics                                | Strong       | Broad JSONPath intrinsic coverage is available.                                                                         |
| JSONata                                   | Strong       | JSONata-based conditions and shaping are among the stronger areas of the project.                                       |
| Validation coverage                       | Good         | Many validation behaviors are covered, but some remain intentionally AWS-only.                                          |
| Advanced distributed `Map` / `ItemReader` | Partial      | Common local cases work. More advanced manifest-driven and service-coupled cases are still limited locally.             |
| Callback / task-token flows               | Partial      | Some support exists, but full callback fidelity is not complete.                                                        |
| Persistence / durable execution           | Out of scope | This package is for testing workflow logic, not running durable production workflows.                                   |

## Conformance coverage snapshot

The repository has a large compatibility suite. Current rough snapshot from the case files:

- about **946 conformance cases**
- across **79 groups**
- about **12 cases per group on average**

Approximate case counts by area:

| Area                         | Approx. case count |
| ---------------------------- | -----------------: |
| Intrinsic functions          |                404 |
| Feature / integration groups |                257 |
| Choice operator groups       |                188 |
| Classic state suites         |                 47 |
| Observation groups           |                 27 |
| Validation groups            |                 23 |

That does **not** mean every Step Functions feature is finished.

It does mean compatibility testing is already deep in the areas that matter most for real workflow logic.

## How to read the suite

The conformance suite has two runners:

- **local**: fast validation against Tiny ASL Machine
- **AWS-backed**: parity-sensitive validation against real Step Functions

Use local conformance for daily logic checks.
Use AWS-backed conformance when parity details matter.

## How to run compatibility tests

```bash
pnpm run test:conformance:local
pnpm run test:conformance:aws
pnpm run test:ci
```

Focused examples:

```bash
pnpm run test:conformance -- --case='group:"Feature.JSONataComposition"'
pnpm run test:conformance -- --case='group:"States.MathAdd"'
pnpm run test:conformance -- --case='id:"006-parquet-versionid-is-unsupported"'
```

## Where AWS should still be the authority

Use AWS-backed checks first when you care about:

- advanced `ItemReader` manifests
- Parquet-backed ingestion behavior
- callback / task-token workflows
- exact validation wording and AWS-only validation rules
- service-coupled edge cases
- very new Step Functions features

## Advanced `Map` / `ItemReader` note

Local support already covers important non-Parquet cases such as:

- JSON item loading
- `ItemsPointer`
- `MaxItems`
- CSV with supported header modes
- JSONL
- `LOAD_AND_FLATTEN` for supported JSON flows

But local support is still limited for:

- advanced manifest-driven flows
- some service-coupled ingestion behavior
- full Parquet local decoding

For Parquet, the project currently prefers clear guardrails instead of pretending to support full local decoding.

## Bottom line

A fair short summary is:

- Tiny ASL Machine has high-value local compatibility for a large part of Step Functions logic
- the project has already done a lot of conformance work
- AWS parity is strong in many areas, but not total
- for hard edge cases, AWS-backed conformance is the authority
