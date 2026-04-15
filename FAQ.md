# FAQ

## What is Tiny ASL Machine?

A local interpreter for AWS Step Functions state machines.

Use it to test workflow logic without deploying on every edit.

## Is it a replacement for AWS Step Functions?

No.

Use this package for local testing.
Use AWS Step Functions for production execution.

## When should I use it?

Use it when you want to:

- test state-machine logic fast
- mock `Task` resources in-process
- reuse the same ASL JSON in tests and deployment
- validate most behavior before a final AWS check

## When should I not use it?

Do not use it as:

- a production runtime
- a persistence layer
- a full AWS emulator
- a full callback/task-token engine

## Do I need AWS credentials?

Not for normal local tests.

You only need AWS credentials when you intentionally run AWS-backed checks.

## What Node version do I need?

Node.js 20 or newer.

## How do I type a machine definition?

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'CallService',
  States: {
    CallService: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
      End: true,
    },
  },
};

const result = await run({ definition }, { value: 1 });
```

## How do I mock a Task resource?

Match the exact `Resource` string from the definition.

```ts
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resourceName, payload) => {
        if (resourceName === 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction') {
          return { ok: true, payload };
        }

        throw new Error(`Unexpected resource: ${resourceName}`);
      },
    },
  },
  { input: 'data' }
);
```

## Can I use the same JSON in tests and production?

Usually yes.

This package matches the exact `Resource` string in your ASL definition, so placeholder strings, internal names, and real ARNs can all work.

## How do I test Choice, Map, and Parallel?

Short answer:

- `Choice`: run the same machine with different inputs
- `Map`: pass a small but meaningful array
- `Parallel`: assert the joined branch result

For fuller examples, use:

- [EXAMPLES.md](EXAMPLES.md)
- `skills/write-local-state-machine-tests/SKILL.md`

## How do I test error paths?

Throw from your mock.

Then assert either:

- the recovered output, if your machine uses `Catch`
- or a rejected run, if the error is not caught

## How do I avoid real waiting in Wait states?

Two common options:

- fake timers from your test framework
- a runtime adapter via `createTestRuntime()`

```ts
import { createTestRuntime, run } from 'tiny-asl-machine';

const runtime = createTestRuntime();
const result = await run({ definition, runtime }, input);
```

## How do I control random, UUID, or time?

Use a runtime adapter.

### Fixed random value

```ts
const runtime = createTestRuntime({
  random: () => 7,
});
```

### Fixed UUID

```ts
const runtime = createTestRuntime({
  randomUUID: () => '11111111-1111-4111-8111-111111111111',
});
```

### Fixed current time

```ts
const runtime = createTestRuntime({
  now: () => '2025-01-01T12:00:00.000Z',
});
```

You can also use your framework timers when that fits better.

## Is Retry supported?

Yes, for normal orchestration scenarios.

For parity-sensitive edge cases, use AWS as the final check.

## Is JSONata supported?

Yes.

JSONata is one of the stronger areas of the project today.

## Are intrinsic functions supported?

Yes.

Coverage is broad, but if you need exact status by function, check:

- [README.md](README.md)
- [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md)
- `tests/conformance/cases/States.*.ts`

## Is advanced ItemReader support complete?

No.

Important local support exists, but advanced manifest-driven and service-coupled cases still have gaps.

Parquet local decoding is intentionally deferred.

## Where should I look for support details?

Start here:

- [README.md](README.md)
- [EXAMPLES.md](EXAMPLES.md)
- [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md)
- `skills/write-local-state-machine-tests/SKILL.md`

## Where is contributor or internal workflow documentation?

Use:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [ENGINEERING_PLAYBOOK.md](ENGINEERING_PLAYBOOK.md)

Those files are for development workflow.
This FAQ is for package users.

## Where do I report bugs or ask for help?

- [GitHub Issues](https://github.com/gabrielmoreira/tiny-asl-machine/issues)
- [GitHub Discussions](https://github.com/gabrielmoreira/tiny-asl-machine/discussions)
