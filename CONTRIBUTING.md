# Contributing

This repository follows the engineering workflow documented in:

- `ENGINEERING_PLAYBOOK.md`

Please read that file first.

---

## Development Workflow Summary

Contributions should follow this model:

- start from behavior, not implementation
- define the validation strategy before coding
- prefer conformance cases as the behavioral specification
- validate against AWS when behavior is ambiguous
- implement in small steps
- run focused checks before and after each meaningful change
- run broader quality before stopping
- keep code, tests, and docs aligned

---

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- optional AWS credentials if you need AWS-backed conformance

Install dependencies:

```sh
pnpm install
```

---

## Daily Commands

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

### Conformance with local + AWS, warning if AWS is unavailable

```sh
pnpm run test:conformance
```

### Focused conformance example

```sh
pnpm run test:conformance -- --case='group:"Feature.Catch"'
```

---

## AWS Conformance

Use AWS when you need real Step Functions behavior.

### Create deployment config

```sh
pnpm run aws:create-deployment-config
```

### Deploy AWS harness resources

```sh
pnpm run aws:deploy-stack
```

### Run AWS-backed conformance

> Keep the harness deployed when you are doing repeated AWS parity work.
> Use teardown only when you intentionally want to remove the stack.

```sh
pnpm run test:conformance:aws
```

### AWS harness lifecycle

> The AWS harness is managed through CloudFormation.

> Local source of truth: `.local/aws/deployment-config.json`

> Typical flow:

```sh
pnpm run aws:create-deployment-config
pnpm run aws:deploy-stack
pnpm run test:conformance:aws
# optional cleanup only when you want to tear the harness down
pnpm run aws:remove-stack
```

## The deployment config file is the source of truth for later commands; no manual shell export step is required.

---

## Focused Conformance Workflow

If you are working on parity or behavior changes, these commands are the main ones to know.

### Run the full local conformance suite

```sh
pnpm run test:conformance:local
```

### Run the AWS-backed conformance suite

```sh
pnpm run test:conformance:aws
```

### Run one group or one focused slice

```sh
pnpm run test:conformance -- --case='group:"Feature.JSONataComposition"'
pnpm run test:conformance -- --case='group:"States.MathAdd"'
pnpm run test:conformance -- --case='id:"006-parquet-versionid-is-unsupported"'
```

The case filter can match fields like:

- `group`
- `id`
- `title`
- `tags`

## How the conformance runners work

### Local conformance

The local runner:

- loads one conformance case
- runs it through Tiny ASL Machine
- uses mocked local resources when needed
- compares output or error with the expected result

### AWS-backed conformance

The AWS runner:

- validates the machine definition with AWS
- creates a temporary Step Functions state machine
- starts one execution with the case input
- waits for completion
- compares AWS output or AWS error with the expected result
- deletes the temporary state machine afterward

Use local conformance for fast feedback.
Use AWS-backed conformance when parity details matter.

## Pull Request Expectations

Pull requests may be rejected if they:

- skip test-first development for behavior changes
- introduce behavior without clear validation
- guess AWS behavior instead of observing it
- leave code, tests, and docs inconsistent

---

## Strong Rule

> If a behavior change is not clearly tested, it is not ready to merge.
