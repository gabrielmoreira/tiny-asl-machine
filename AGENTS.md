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
