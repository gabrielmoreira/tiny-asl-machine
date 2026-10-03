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
pnpm run verify
mise install node@22.0.0
pnpm run test:package
```

CI runs the quality gates on Linux, Windows, and macOS across the development Node.js matrix. Separate consumer jobs install a real packed tarball and exercise CJS, ESM, and strict TypeScript consumers on both the development runtime and exactly Node.js 22.0.0. `test:ci` explicitly disables AWS.

The build must preserve CommonJS `lib/index.js`, the ESM shim `lib/index.mjs`, declarations in `lib/index.d.ts` and root `types/`, and ES2024 output for the Node.js >=22 consumer floor. `@types/node` stays on the consumer-floor major so typechecking rejects newer Node.js APIs. Do not add `type: module` to the package. Raise the consumer runtime floor only as a deliberate breaking change, not as a side effect of a tooling upgrade.

### Editor integration

Install the workspace's recommended VS Code extensions for Oxc/Vite+ and the TypeScript 7 native language service. The official TypeScript extension still uses the ID `TypeScriptTeam.native-preview`; it reads the stable workspace `typescript` package, not `@typescript/native-preview`.

The workspace settings select pnpm for the Scripts panel and `vite.config.ts` for formatting. When refreshing Git hook setup, keep `--no-agent` in the prepare script so installation does not rewrite the project's hand-maintained `AGENTS.md`.

### Releases

Merge conventional commits into `main`. `feat:` requests a minor, `fix:` a patch, and `!` or a `BREAKING CHANGE:` footer a major. Ordinary `chore:` and `docs:` changes do not release. Both version analysis and notes use the `conventionalcommits` preset, so breaking headers work without a footer. Release versions belong to Git tags and the tarball, not version-bump commits.

After all reusable CI jobs pass, the Prepare release workflow calculates the next version, builds and tests its tarball, and creates a **draft** GitHub Release with notes and that verified asset. Review and publish the draft in GitHub Releases to trigger npm publishing. Do not change its tag or replace its asset. A stable release tag must be on `main`; prereleases are not published by this workflow.

Before preparing a draft, the workflow checks the release state from Git tags, GitHub Releases, and the npm registry. A tag whose draft was never created (for example, after a GitHub API outage during release) is an **orphan**: semantic-release would silently treat it as the last release and never create the missing draft. The check fails loudly instead, and rerunning the workflow with `repair_tag` set to that tag rebuilds its tarball from the tag's commit, tests it, and recreates the draft. A tag whose draft is still unpublished makes the workflow wait: publish the older draft first, because npm rejects a newer version published before an older one.

`publish.yml` installs and tests the attached tarball again, then publishes those exact bytes to npm using OIDC and provenance, without an npm token or package lifecycle hooks. It subsequently installs the exact registry version and exercises the same consumers. Rerunning a failed publishing job is safe only when npm already contains the identical tarball; different bytes or a downgrade of `latest` are rejected.

The registry check after publishing waits for npm to serve the new version, bounded to a few minutes, because npm processes a fresh version for a short time before it installs. The wait length is overridable locally with `REGISTRY_WAIT_ATTEMPTS` and `REGISTRY_WAIT_DELAY_MS`.

**One-time npm setup:** in the `tiny-asl-machine` package settings, configure a GitHub Actions trusted publisher for owner `gabrielmoreira`, repository `tiny-asl-machine`, workflow filename `publish.yml`, no environment name, and allow direct `npm publish`. Do this before publishing the first draft. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). No `NPM_TOKEN` or PAT is needed. A human publishes the draft because GitHub Releases created with `GITHUB_TOKEN` do not trigger other workflows.

Use the Prepare release workflow's manual dispatch with `dry_run: true` to preview the version and notes without creating a tag or draft. `release:baseline` seeds the verified npm 1.0.0 commit as a local `v1.0.0` tag when absent; semantic-release pushes it only during a real release. This avoids trying to republish npm 1.0.0. The first release after the Node.js floor change is 2.0.0.

To exercise release preparation locally without creating a GitHub Release or publishing:

```sh
mise install node@22.0.0
pnpm run verify
node scripts/prepare-release.mjs 2.0.0
```

The preparation script restores `package.json` and leaves the verified asset under `.local/release/`. `test:package --tarball <path>` checks a supplied tarball; `test:package --version <exact version>` checks an already-published version. Failure logs are retained in an isolated OS temporary directory; successful consumers are removed.

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
