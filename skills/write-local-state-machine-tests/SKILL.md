# Write local state machine tests

Use this skill when you already have an Amazon States Language definition and want fast, local tests for branching, data flow, and mocked Task resources.

## What this package is good at

`tiny-asl-machine` is a local interpreter for Step Functions state machines. It is a good fit for tests that:

- load a real state machine JSON definition from your project
- keep `Resource` strings exactly as they appear in that definition
- replace Task resources with local mocks
- assert final output after Pass, Task, Choice, Map, Parallel, Wait, Catch, and Fail flows
- exercise happy paths and failure paths without deploying to AWS

## Core testing loop

1. Load the machine definition you already use in your app or infrastructure code.
2. Build a `resourceContext.invoke(resource, payload)` function.
3. Return mocked results based on the incoming `resource` string.
4. Run the machine with `run({ definition, resourceContext }, input)`.
5. Assert the final output or thrown error.

```ts
import { run } from 'tiny-asl-machine';
import definition from './stateMachine.json';

const resources = {
  '{chargeCustomerArn}': async (payload: unknown) => ({
    ok: true,
    chargeId: 'ch_123',
    payload,
  }),
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        const handler = resources[resource as keyof typeof resources];
        if (!handler) {
          throw new Error(`Missing mock for resource: ${resource}`);
        }
        return handler(payload);
      },
    },
  },
  { orderId: 'order-123', amount: 42 }
);
```

## What to cover in local tests

- final output shape and values
- branch selection in `Choice` states
- per-item behavior in `Map` states
- branch results in `Parallel` states
- caught failures via `Catch`
- uncaught failures that should reject the run
- Wait-heavy flows with a custom runtime when you want deterministic time

## When local tests are enough

Prefer local tests when you want confidence in:

- JSONPath and parameter wiring
- branching logic
- task orchestration
- mocked service responses
- most application-specific state machine behavior

## When to use AWS-backed conformance instead

Use AWS-backed validation when you need confidence in behavior that depends on Step Functions itself rather than your local mocks, especially for:

- edge cases where AWS service behavior matters
- compatibility checks against managed Step Functions behavior
- features where exact AWS retry edge-case behavior or broader production-only semantics matter
- final verification before relying on a workflow shape that uses less common ASL features

## References

- [Quickstart](./references/quickstart.md)
- [Testing patterns](./references/patterns.md)
