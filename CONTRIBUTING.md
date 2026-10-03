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

- Use the development tools pinned in `mise.toml` (`mise install`).
- Without mise, use Node.js 22 (>=22.22.1), 24 (>=24.11.0), or 26, and the pnpm version declared in `package.json`'s `packageManager` field.
- AWS credentials are optional and only needed for AWS-backed conformance.

The published library supports Node.js >=22.0.0 consumers, the oldest maintained Node.js LTS line. Development needs the newer 22.x patch floor above because Vite+ and staged checks require it; see the [upstream staged-check requirements](https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/commit-hooks.md).

Use pnpm for dependency management and the scripts in `package.json` for project tasks. Those scripts use project-local Vite+ for formatting, linting, and tests, and the stable TypeScript 7 native `tsc` for typechecking and package compilation. Tool versions live in the manifests rather than in this guide.

`vite.config.ts` holds format, lint, staged-check, and test configuration. Keep tests importing from `vite-plus/test`; do not add a separate Vitest configuration or native-preview compiler dependency.

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

### TypeScript typecheck

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

### CI-equivalent gates without AWS

```sh
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test:ci
pnpm run build
```

CI runs these gates on Linux, Windows, and macOS across the supported development Node.js majors. `test:ci` explicitly disables AWS, even when credentials or a deployed harness are available.

The build must preserve CommonJS `lib/index.js`, the ESM shim `lib/index.mjs`, declarations in `lib/index.d.ts` and root `types/`, and ES2024 output for the Node.js >=22 consumer floor. `@types/node` stays on the consumer-floor major so typechecking rejects newer Node.js APIs. Do not add `type: module` to the package. Raise the consumer runtime floor only as a deliberate breaking change, not as a side effect of a tooling upgrade.

### Editor integration

Install the workspace's recommended VS Code extensions for Oxc/Vite+ and the TypeScript 7 native language service. The official TypeScript extension still uses the ID `TypeScriptTeam.native-preview`; it reads the stable workspace `typescript` package, not `@typescript/native-preview`.

The workspace settings select pnpm for the Scripts panel and `vite.config.ts` for formatting. When refreshing Git hook setup, keep `--no-agent` in the prepare script so installation does not rewrite the project's hand-maintained `AGENTS.md`.

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
