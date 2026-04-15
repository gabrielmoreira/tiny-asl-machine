# Tiny ASL Machine

A lightweight TypeScript interpreter for AWS Step Functions' Amazon States Language (ASL), built for local testing.

**Best for:** exercising Step Functions logic in unit and integration tests with mocked resource handlers  
**Not for:** running production workflows, persisting executions, or replacing AWS Step Functions

[![npm version](https://badge.fury.io/js/tiny-asl-machine.svg)](https://badge.fury.io/js/tiny-asl-machine)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Installation

```bash
npm install tiny-asl-machine
pnpm add tiny-asl-machine
yarn add tiny-asl-machine
```

## Quick Start

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

console.log(result);
```

## What this library is good at

Tiny ASL Machine is for the part of Step Functions development that is awkward to validate in AWS on every edit: workflow logic.

Its sweet spot is local execution of ASL definitions where you want to:

- keep the state machine JSON close to production
- mock Task resources in-process
- verify branching, dataflow, retries, catches, waits, map/parallel behavior, and output shaping
- iterate quickly before or alongside AWS-backed tests

If you need durable executions, callback/task-token workflows with full service fidelity use AWS Step Functions itself.

## Typed definition examples

All examples below annotate the machine with `StateDefinition` so users can see the package type directly in normal usage.

### Choice state

```ts
import { type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'CheckAmount',
  States: {
    CheckAmount: {
      Type: 'Choice',
      Choices: [{ Variable: '$.amount', NumericGreaterThan: 1000, Next: 'HighValue' }],
      Default: 'Standard',
    },
    HighValue: { Type: 'Pass', Result: 'Needs approval', End: true },
    Standard: { Type: 'Pass', Result: 'Auto-approved', End: true },
  },
};
```

### Parallel execution

```ts
import { type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'ParallelWork',
  States: {
    ParallelWork: {
      Type: 'Parallel',
      Branches: [
        { StartAt: 'Task1', States: { Task1: { Type: 'Pass', Result: 'Done', End: true } } },
        { StartAt: 'Task2', States: { Task2: { Type: 'Pass', Result: 'Done', End: true } } },
      ],
      End: true,
    },
  },
};
```

### Map iteration

```ts
import { type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'ProcessItems',
  States: {
    ProcessItems: {
      Type: 'Map',
      ItemsPath: '$.items',
      Iterator: {
        StartAt: 'ProcessOne',
        States: {
          ProcessOne: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:ProcessItem',
            End: true,
          },
        },
      },
      End: true,
    },
  },
};
```

### Error handling with Catch

```ts
import { type StateDefinition } from 'tiny-asl-machine';

const definition: StateDefinition = {
  StartAt: 'RiskyTask',
  States: {
    RiskyTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Risky',
      Catch: [
        {
          ErrorEquals: ['States.ALL'],
          Next: 'HandleError',
          ResultPath: '$.error',
        },
      ],
      Next: 'Success',
    },
    HandleError: { Type: 'Pass', Result: 'Recovered', End: true },
    Success: { Type: 'Succeed' },
  },
};
```

More examples: [EXAMPLES.md](EXAMPLES.md) | [Real-world ETL test](tests/sampleETLOrchestration.spec.ts)

## Same JSON for tests and production

One of the most useful properties of the library is that it matches Task resources by the exact string in your ASL definition. In practice, that means you can usually test the same JSON you deploy, as long as your `resourceContext` knows how to respond to those resource names.

### Scenario 1: Placeholder resources in source control

If your project keeps placeholders that are resolved during deployment:

```json
// stateMachine.json
{
  "StartAt": "ProcessPayment",
  "States": {
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "{myPaymentLambdaArn}",
      "Next": "ValidateResult"
    },
    "ValidateResult": {
      "Type": "Choice",
      "Choices": [{ "Variable": "$.status", "StringEquals": "approved", "Next": "Success" }],
      "Default": "Fail"
    },
    "Success": { "Type": "Succeed" }
  }
}
```

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import stateMachineJson from './stateMachine.json';

const definition: StateDefinition = stateMachineJson;

it('processes an approved payment', async () => {
  const result = await run(
    {
      definition,
      resourceContext: {
        invoke: async resource => {
          if (resource === '{myPaymentLambdaArn}') {
            return { status: 'approved', txnId: 'TXN-123' };
          }

          throw new Error(`Unexpected resource: ${resource}`);
        },
      },
    },
    { amount: 100 }
  );

  expect(result.status).toBe('approved');
});
```

Your deployment system can still replace `{myPaymentLambdaArn}` with the real ARN later.

### Scenario 2: Exported definitions from AWS

If you export a deployed state machine from AWS, you can mock the resolved ARN strings directly:

```json
// stateMachine-deployed.json
{
  "StartAt": "ProcessPayment",
  "States": {
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
      "Next": "ValidateResult"
    }
  }
}
```

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import stateMachineJson from './stateMachine-deployed.json';

const definition: StateDefinition = stateMachineJson;

it('processes an approved payment', async () => {
  const result = await run(
    {
      definition,
      resourceContext: {
        invoke: async resource => {
          if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment') {
            return { status: 'approved', txnId: 'TXN-123' };
          }

          throw new Error(`Unexpected resource: ${resource}`);
        },
      },
    },
    { amount: 100 }
  );

  expect(result.status).toBe('approved');
});
```

That keeps your tests close to the definition AWS actually runs, without maintaining a separate test-only version of the state machine.

## 📦 Packaged testing guide

The published package includes a user-facing guide at:

- `skills/write-local-state-machine-tests/SKILL.md`

Use it when you want a compact playbook for patterns like:

- exact resource-string mocking
- failure-path tests
- `Choice`, `Map`, and `Parallel` assertions
- payload-shaping verification
- deciding when local tests are enough and when AWS should be the final check

## ✨ Why people use this package

A lot of effort has gone into AWS-first conformance work, especially around the parts of Step Functions that tend to break real workflows:

- branching and transition logic
- JSONPath-style dataflow shaping
- `Catch` / `Retry` behavior
- intrinsic functions
- modern JSONata authoring
- `Map` and `Parallel` composition

So while this project does **not** claim full AWS parity, it does offer a **high-confidence local testing experience** for a large portion of real-world Step Functions logic.

## 🚀 Coverage at a glance

| Area                                 | Status          | What that means for you                                                                                                   |
| ------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Core states                          | 🟢 Very strong  | `Task`, `Pass`, `Choice`, `Wait`, `Parallel`, `Map`, `Succeed`, and `Fail` are all available for local execution.         |
| Dataflow                             | 🟢 Very strong  | `InputPath`, `OutputPath`, `ResultPath`, `Parameters`, and `ResultSelector` are covered well for everyday workflow tests. |
| Error handling                       | 🟢 Very strong  | `Catch` and `Retry` are usable for common orchestration scenarios and heavily exercised in conformance work.              |
| Intrinsics                           | 🟢 Very strong  | Broad JSONPath intrinsic coverage is available for transformation-heavy workflows.                                        |
| JSONata support                      | 🟢 Very strong  | Modern JSONata-based authoring is one of the strengths of the project today.                                              |
| Advanced Map / distributed patterns  | 🟡 Partial      | Common local `Map` use cases work well; some advanced `ItemReader` and manifest-driven flows are still limited locally.   |
| Callback patterns                    | 🟡 Partial      | Task-token related behavior exists in limited form, but full callback fidelity is not complete.                           |
| Persistence / long-running execution | 🔴 Out of scope | Durable execution, pause/resume, and production-engine behavior are not what this package is for.                         |

For a deeper breakdown, see [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md).

## Real-world example

The repository includes a [test based on AWS's ETL orchestration sample](tests/sampleETLOrchestration.spec.ts). It demonstrates how the library can exercise realistic state-machine structure locally while still leaving AWS as the final authority for edge-case parity.

## What's not supported

- Production workflow execution
- Durable execution state or pause/resume
- Full AWS service-integration fidelity
- Complete task-token callback semantics
- Every advanced distributed Map data source and manifest format locally

Use AWS Step Functions for production workloads and for final confirmation of behavior that depends on service-level semantics.

## Resources

- [Examples & Patterns](EXAMPLES.md)
- [FAQ](FAQ.md)
- [ASL Compatibility Details](ASL_COMPATIBILITY.md)
- [Report Issues](https://github.com/gabrielmoreira/tiny-asl-machine/issues)

## License

MIT - See [LICENSE](LICENSE)
