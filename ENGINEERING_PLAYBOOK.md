# Engineering Playbook

## Purpose

This repository implements a local execution environment for **Amazon States Language (ASL)**.

It is not only a runtime.

It is a **conformance system**, where behavior is:

- defined through test cases
- executed locally (`tiny-asl-machine`)
- optionally executed on AWS Step Functions
- compared and aligned over time

The goal is to converge local behavior with real AWS behavior whenever the specification or current implementation is ambiguous.

---

## System Model

The repository has two execution targets:

- local runtime (`tiny-asl-machine`)
- AWS Step Functions (via the harness in `scripts/` and `.local/aws/`)

And one primary unit of validation:

- **conformance cases** in `tests/conformance/cases/`

A conformance case defines behavior once and can often run in both environments.

---

## Core Principles

### Conformance-first

Behavior should be expressed as conformance cases whenever possible.

Tests are not just validation. They are the specification.

### Test before implementation

Every logical change starts with a failing test or a failing quality signal.

Examples:

- runtime behavior change → add or update a focused test first
- type-system change → reproduce with `tsc` / `oxlint` / type fixtures first
- AWS parity question → add an AWS-observable conformance case first when possible

### AWS as behavioral reference

When behavior is unclear or ambiguous:

- prefer observing AWS
- do not guess

### Continuous quality

Quality should be run before and after meaningful changes.

Current quality tools in this repository are:

- conformance tests (`pnpm run test:conformance`)
- TypeScript compile (`pnpm run typecheck`)
- Oxlint (`pnpm run lint`)
- Oxfmt (`pnpm run format:check`)

### Explicit type safety

Prefer:

- type guards
- explicit narrowing
- runtime validation when input shape matters

Avoid:

- unsafe casts in production code
- hidden assumptions

### Consistency across code, tests, and documentation

All three must describe the same behavior.

---

## Required Workflow

### Phase 0 — Baseline Quality

Before changing behavior, run the most relevant baseline.

Examples:

```sh
pnpm run typecheck
pnpm run test:conformance:local
pnpm run lint
pnpm run format:check
```

Use focused commands when the area is small and you need a quick before/after signal.

### Phase 1 — Problem Understanding

Do not write code first.

Clarify:

- what behavior is wrong or missing
- whether the issue is:
  - ASL semantics
  - AWS behavior
  - local runtime limitation
  - type-surface mismatch

### Phase 2 — Behavior Modeling

Describe:

- happy paths
- failure paths
- edge cases

If unclear:

- validate behavior against AWS

### Phase 3 — Conformance Design

Translate behavior into tests.

Prefer conformance cases that can run in both:

- local runtime
- AWS Step Functions

Each case should clearly define:

- `definition`
- `input`
- `expected`
- whether it is local-only / aws-only / dual-run

### Phase 4 — Failing Test

Write or update the test.

Ensure:

- it fails for the correct reason
- the failure proves the current behavior is deficient or inconsistent

### Phase 5 — Implementation

Implement in small steps.

Rules:

- keep responsibilities separated
- avoid hidden dependencies
- avoid widening behavior accidentally
- prefer minimal diffs

### Phase 6 — Focused Validation

Run the specific test(s) again.

Confirm:

- the intended behavior is now correct
- nothing unrelated had to change

### Phase 7 — Full Quality

Run broader quality again:

```sh
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
```

### Phase 8 — Review and Consistency Check

Validate consistency.

#### Documentation vs Implementation

- does documentation reflect current behavior?

#### Tests vs Behavior

- do tests actually prove the claim?

#### AWS vs Local

- is behavior aligned?
- if not, is the difference understood and documented?

### Phase 9 — Build (only when needed)

Build is separate from quality.

Run when needed:

```sh
pnpm run build
```

---

## Practical Commands

## Install

```sh
pnpm install
```

## Local Quality

### Format

```sh
pnpm run format
pnpm run format:check
```

### Lint

```sh
pnpm run lint
pnpm run lint:fix
```

### TypeScript compile

```sh
pnpm run typecheck
```

### Full local suite without AWS

```sh
pnpm run test:local
```

### Default test run (auto-enables AWS when available)

```sh
pnpm test
```

### Conformance in local + AWS, warning if AWS is unavailable

```sh
pnpm run test:conformance
```

### Focus a conformance group or case

Examples:

```sh
pnpm test -- --case='group:"Feature.Catch"'
pnpm run test:conformance -- --case='id:"010-max-concurrency-path-limits-parallelism"'
```

### AWS-backed conformance only

```sh
pnpm run test:conformance:aws
```

---

## Running Against AWS

AWS execution is optional and is used when:

- behavior is ambiguous
- local vs AWS parity must be checked
- a conformance case is explicitly dual-run or aws-only

## Prerequisites

You need:

- AWS credentials available to the shell
- permission to manage the temporary harness resources used by this repo
- Node.js and pnpm already installed

The harness reads configuration from:

- your shell environment
- optional `.env`
- `.local/aws/deployment-config.json` (created by `aws:create-deployment-config` and updated by `aws:deploy-stack`)

The deployment config file is the local source of truth for later AWS test commands. The harness itself is provisioned via CloudFormation.

## Step 1 — Create deployment config

```sh
pnpm run aws:create-deployment-config
```

This resolves stable local/AWS metadata such as:

- region
- account id
- workspace hash
- resource names
- snapshot redaction tags

## Step 2 — Deploy AWS harness resources

```sh
pnpm run aws:deploy-stack
```

What this does, in practice:

- creates or updates the AWS Lambda fixture used by the harness
- creates or updates the IAM roles needed by the harness
- updates `.local/aws/deployment-config.json` with deployed resource ARNs and environment values

The deployment config is the local source of truth for later commands. No manual shell export step is required.

## Step 3 — Run AWS-aware tests

### Run the default full suite (auto-enables AWS when available)

```sh
pnpm test
```

### Run the full suite locally only

```sh
pnpm run test:local
```

### Run the full suite with AWS required

```sh
pnpm run test:aws
```

### Run conformance with local + AWS, warning if AWS is unavailable

```sh
pnpm run test:conformance
```

Any of the above can be focused further with `-- --case='...'`.

## Step 4 — Remove AWS harness resources when done

```sh
pnpm run aws:remove-stack
```

What this does:

- deletes harness-managed state machines
- deletes the Lambda fixture
- deletes the harness IAM roles when they are tagged as managed by this repo
- removes the local harness manifest

---

## Local vs AWS: Practical Guidance

### Prefer local when

- iterating quickly
- proving basic runtime behavior
- refining tests before AWS observation

### Prefer AWS when

- behavior is ambiguous in the spec
- local behavior may be incorrect
- you need real Step Functions semantics
- you are adding or changing parity-sensitive behavior

### Typical flow

1. start from AWS-first behavior when the feature is parity-sensitive or the spec is unclear
2. write an AWS-backed case first, or pair a local case with an AWS-backed case immediately
3. make the local behavior fail for the right reason
4. implement minimally
5. validate locally and against AWS for the touched behavior
6. document any intentional difference

---

## Project Structure (practical)

- `src/` — runtime implementation
- `types/` — ASL and runtime type surface
- `tests/conformance/cases/` — behavior catalog / conformance specification
- `tests/conformance/support/` — harness helpers for local/AWS execution
- `scripts/aws-setup.mjs` — create/update AWS harness resources
- `scripts/aws-teardown.mjs` — remove AWS harness resources
- `scripts/run-vitest.mjs` — wrapper that controls local/AWS conformance mode
- `.local/aws/harness-manifest.json` — generated AWS harness metadata

---

## Strong Rules

> Never implement before defining how to test and validate the behavior.

> Conformance cases define behavior. Code follows.

> Code, tests, and documentation must always tell the same story.
