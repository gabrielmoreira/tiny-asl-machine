# Agent Instructions

Follow the engineering workflow in:

- `ENGINEERING_PLAYBOOK.md`

---

## Required Workflow

When implementing changes:

1. Understand the behavior before coding.
2. Decide how to test it.
3. Prefer conformance cases that run in:
   - local runtime
   - AWS Step Functions
4. Model:
   - happy paths
   - failures
   - edge cases
5. Add a failing test first when behavior must change.
6. Implement in small steps.
7. Re-run the focused test.
8. Re-run broader quality after the change.
9. Check that docs, code, and tests still agree.

---

## Practical Quality Commands

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

### TypeScript

```sh
pnpm run typecheck
```

### Local conformance

```sh
pnpm run test:local
```

### Focused conformance

```sh
pnpm test -- --case='group:"Feature.Catch"'
pnpm run test:conformance -- --case='id:"010-max-concurrency-path-limits-parallelism"'
```

### AWS-aware runs

```sh
pnpm test
pnpm run test:aws
pnpm run test:conformance
```

---

## Critical Rules

- Do not start coding without a test strategy.
- Do not guess AWS behavior when it can be observed.
- Prefer type guards and explicit narrowing over unsafe assumptions.
- Re-run focused validation after each behavior change.
- Re-run broader quality before stopping.

---

## One-line Rule

> If you cannot explain how the behavior is tested, you are not ready to implement it.

## Project Tooling

- Use the development tools pinned in `mise.toml` and the pnpm version in `package.json`'s `packageManager` field. See `CONTRIBUTING.md` for the development Node.js requirements; Node.js >=22.0.0 is the published-library consumer contract, not the tooling requirement.
- Use pnpm for dependencies and `pnpm run <script>` for project tasks. The scripts resolve project-local tools; a global `vp` installation is not required.
- Vite+ owns formatting, linting, staged checks, and tests in `vite.config.ts`. Import test APIs from `vite-plus/test`; do not add a separate `vitest.config.ts` or standalone Vitest dependency.
- Stable TypeScript 7 provides the native `tsc` used for typechecking and compilation. Do not restore `@typescript/native-preview`, `tsgo` scripts, or the old JavaScript compiler path under `node_modules/typescript/bin/tsc`.
- The full CI-equivalent gates are `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:ci`, and `pnpm run build`. `test:ci` is local-only and must not require AWS credentials. AWS remains the behavioral reference when parity is ambiguous.
- Preserve the published package: CommonJS `lib/index.js`, ESM shim `lib/index.mjs`, `lib/index.d.ts` plus root `types/`, ES2024 output, no `type: module`, and Node.js >=22 consumers. Keep `@types/node` on the consumer-floor major.
- This file is hand-maintained. Keep `--no-agent` in the prepare script's `vp config` invocation so tool setup cannot overwrite project guidance.
