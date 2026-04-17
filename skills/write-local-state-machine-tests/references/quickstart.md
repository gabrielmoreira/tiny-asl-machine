# Quickstart

This guide shows a practical way to test an existing ASL definition locally with `tiny-asl-machine`.

## 1. Load a real definition

Start from the JSON you already ship or generate.

```ts
import { run } from 'tiny-asl-machine';
import definition from './checkout-state-machine.json';
```

You do not need to rename resources for local tests. The package passes the `Resource` string from the definition into `resourceContext.invoke(...)`.

That means all of these can work as-is:

- deployment placeholders like `{chargeCustomerArn}`
- local identifiers like `payment-service.charge`
- full ARNs exported from AWS

## 2. Mock resources by exact string match

A simple pattern is a lookup table keyed by the exact `Resource` value.

```ts
const mockResources: Record<string, (payload: unknown) => Promise<unknown>> = {
  '{chargeCustomerArn}': async payload => ({
    status: 'approved',
    chargeId: 'ch_123',
    input: payload,
  }),
  '{reserveInventoryArn}': async payload => ({
    reserved: true,
    input: payload,
  }),
};

function createInvoke() {
  return async (resource: string, payload: unknown) => {
    const mock = mockResources[resource];
    if (!mock) {
      throw new Error(`No mock registered for resource: ${resource}`);
    }
    return mock(payload);
  };
}
```

Failing fast on unknown resources is useful because it catches unmocked Task states immediately.

## 3. Run the machine and assert the final output

```ts
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: createInvoke(),
    },
  },
  {
    orderId: 'order-123',
    amount: 42,
    items: [{ sku: 'sku-1', quantity: 1 }],
  }
);

expect(result).toEqual({
  orderId: 'order-123',
  amount: 42,
  items: [{ sku: 'sku-1', quantity: 1 }],
  payment: {
    status: 'approved',
    chargeId: 'ch_123',
  },
  inventory: {
    reserved: true,
  },
});
```

Exact expectations are often the clearest choice when your state machine is mostly data transformation and orchestration.

## 4. Test failure paths

You can reject from a mock to simulate Task failure.

```ts
const mockResources: Record<string, (payload: unknown) => Promise<unknown>> = {
  '{chargeCustomerArn}': async () => {
    throw new Error('card declined');
  },
};
```

If your definition catches that error, assert the handled output:

```ts
const result = await run(
  {
    definition,
    resourceContext: { invoke: createInvoke() },
  },
  { orderId: 'order-123' }
);

expect(result).toMatchObject({
  error: {
    Error: 'Error',
    Cause: 'card declined',
  },
});
```

If your definition does not catch it, assert rejection:

```ts
await expect(
  run(
    {
      definition,
      resourceContext: { invoke: createInvoke() },
    },
    { orderId: 'order-123' }
  )
).rejects.toThrow('card declined');
```

## 5. Keep Wait-heavy tests deterministic when needed

If your machine uses `Wait` states, pass a custom runtime so the test does not sleep for real time.

```ts
import { createTestRuntime, run } from 'tiny-asl-machine';

const runtime = createTestRuntime();

const result = await run(
  {
    definition,
    runtime,
    resourceContext: { invoke: createInvoke() },
  },
  input
);
```

`createTestRuntime()` gives you predictable time and instant sleep, which is useful for polling-style workflows.

## 6. Choose the right assertion level

A good local test usually checks one of these:

- the whole final output
- the specific field affected by a branch or task
- that a run rejects with the expected error
- that a mock was called with the payload you expected after `Parameters`, `InputPath`, or `ResultPath` processing

## 7. Know when to step up to AWS-backed checks

Local tests are best for fast feedback on logic. Use AWS-backed conformance checks when you need stronger confidence that a workflow behaves like managed Step Functions for a feature or edge case this package does not fully cover.
