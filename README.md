# Tiny ASL Machine

A lightweight TypeScript interpreter for AWS Step Functions' Amazon States Language (ASL), built for local testing.

**Best for:** testing workflow logic locally with mocked `Task` resources
**Not for:** production workflow execution, durable state, or full AWS emulation

[![npm version](https://badge.fury.io/js/tiny-asl-machine.svg)](https://badge.fury.io/js/tiny-asl-machine)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Install

```bash
npm install tiny-asl-machine
pnpm add tiny-asl-machine
yarn add tiny-asl-machine
```

## Quick start

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'MyTask',
  States: {
    MyTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
      End: true,
    },
  },
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, input) => {
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction') {
          return { processed: true, ...input };
        }

        throw new Error(`Unexpected resource: ${resource}`);
      },
    },
  },
  { data: 'test' }
);
```

## What it is good at

Use Tiny ASL Machine when you want to:

- keep your ASL definition close to production
- mock `Task` resources in-process
- test branching, dataflow, retries, catches, waits, `Map`, and `Parallel` locally
- move quickly locally, then confirm parity-sensitive behavior on AWS

## What it is not

Do not use it as:

- a production Step Functions replacement
- a durable execution engine
- a persistence layer
- a full AWS service-integration emulator

## Support at a glance

| Area                                      | Status       | Notes                                                                   |
| ----------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| Core states                               | Strong       | `Task`, `Pass`, `Choice`, `Wait`, `Parallel`, `Map`, `Succeed`, `Fail`  |
| Dataflow                                  | Strong       | `InputPath`, `OutputPath`, `ResultPath`, `Parameters`, `ResultSelector` |
| Error handling                            | Strong       | `Catch` and `Retry` for normal orchestration flows                      |
| Intrinsics                                | Strong       | broad JSONPath intrinsic coverage                                       |
| JSONata                                   | Strong       | one of the strongest areas of the project                               |
| Advanced distributed `Map` / `ItemReader` | Partial      | common local cases work; advanced service-coupled shapes still need AWS |
| Callback / task-token fidelity            | Partial      | some support exists, but not full service fidelity                      |
| Durable execution                         | Out of scope | use AWS Step Functions for that                                         |

For deeper status, use [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md).

## Same JSON for tests and production

The library matches `Task` resources by the exact `Resource` string in the ASL definition.

That means local tests can usually use the same definition you deploy, whether your file contains:

- deployment placeholders like `{chargeCustomerArn}`
- internal resource names
- full AWS ARNs

## When to use AWS-backed checks

Use local tests for fast feedback.
Use AWS-backed conformance when:

- behavior is parity-sensitive
- validation rules matter
- you are relying on less common ASL features
- you need a final answer on real Step Functions behavior

## Main docs

- [Examples](EXAMPLES.md)
- [FAQ](FAQ.md)
- [ASL compatibility guide](ASL_COMPATIBILITY.md)
- [Contributing](CONTRIBUTING.md)
- [Engineering playbook](ENGINEERING_PLAYBOOK.md)
- [Skill: write local state machine tests](skills/write-local-state-machine-tests/SKILL.md)

## Useful repository references

- `tests/sampleETLOrchestration.spec.ts` — realistic example
- `tests/conformance/cases/` — compatibility coverage by feature/group
- `tests/conformance.spec.ts` — unified local/AWS conformance runner

## Bottom line

Tiny ASL Machine gives you a high-confidence local testing workflow for a large part of real Step Functions logic.

For production semantics and hard edge cases, AWS remains the authority.

## License

MIT - See [LICENSE](LICENSE)
