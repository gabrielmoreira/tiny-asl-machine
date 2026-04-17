# Testing patterns

Use these patterns to build local tests around real state machine definitions without turning tests into a second implementation.

## Pattern: one resource registry per test file

When a machine touches several Task states, collect mocks in one registry.

```ts
const mockResources: Record<string, (payload: unknown) => Promise<unknown>> = {
  '{validateInputArn}': async payload => ({ valid: true, payload }),
  '{chargeCustomerArn}': async payload => ({ ok: true, payload }),
  '{sendReceiptArn}': async payload => ({ sent: true, payload }),
};

const invoke = async (resource: string, payload: unknown) => {
  const mock = mockResources[resource];
  if (!mock) throw new Error(`Unhandled resource: ${resource}`);
  return mock(payload);
};
```

This keeps each test focused on input, overrides, and assertions.

## Pattern: override only the resource you care about

Start from a shared registry, then replace one mock in a single test.

```ts
const baseResources = {
  '{chargeCustomerArn}': async () => ({ status: 'approved' }),
  '{reserveInventoryArn}': async () => ({ reserved: true }),
};

const mockResources = {
  ...baseResources,
  '{chargeCustomerArn}': async () => {
    throw new Error('card declined');
  },
};
```

That makes failure-path tests easy to read.

## Pattern: assert branch outcomes for Choice states

For `Choice` logic, run the same definition with different inputs and assert the final result for each branch.

```ts
await expect(run({ definition }, { amount: 5 })).resolves.toEqual({ route: 'small' });
await expect(run({ definition }, { amount: 50 })).resolves.toEqual({ route: 'standard' });
await expect(run({ definition }, { amount: 500 })).resolves.toEqual({ route: 'manual-review' });
```

Use a small matrix of inputs rather than one oversized test.

## Pattern: verify payload shaping at Task boundaries

If your machine uses `InputPath`, `Parameters`, or `ResultPath`, assert the payload your mock actually receives.

```ts
const chargeCustomer = vi.fn(async payload => ({ status: 'approved', payload }));

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource === '{chargeCustomerArn}') {
          return chargeCustomer(payload);
        }
        throw new Error(`Unhandled resource: ${resource}`);
      },
    },
  },
  {
    customer: { id: 'cust-1' },
    checkout: { total: 42 },
    internalOnly: true,
  }
);

expect(chargeCustomer).toHaveBeenCalledWith({
  customerId: 'cust-1',
  total: 42,
});
```

This is often more valuable than asserting every intermediate field in the final result.

## Pattern: test Map with realistic item arrays

For `Map`, give the machine a short but meaningful array and assert the collected output.

```ts
const processItem = vi.fn(async item => ({ ...item, processed: true }));

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource === '{processItemArn}') return processItem(payload);
        throw new Error(`Unhandled resource: ${resource}`);
      },
    },
  },
  {
    items: [
      { id: 'a', quantity: 1 },
      { id: 'b', quantity: 2 },
    ],
  }
);

expect(result.items).toEqual([
  { id: 'a', quantity: 1, processed: true },
  { id: 'b', quantity: 2, processed: true },
]);
expect(processItem).toHaveBeenCalledTimes(2);
```

If you care about item-specific behavior, inspect the calls as well as the final array.

## Pattern: test Parallel by asserting branch result positions

`Parallel` returns an array of branch outputs. Assert the shape you expect from each branch.

```ts
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async resource => {
        if (resource === '{branchAArn}') return { branch: 'A', ok: true };
        if (resource === '{branchBArn}') return { branch: 'B', ok: true };
        throw new Error(`Unhandled resource: ${resource}`);
      },
    },
  },
  input
);

expect(result).toEqual([
  { branch: 'A', ok: true },
  { branch: 'B', ok: true },
]);
```

When a later state reshapes the branch array, assert the post-Parallel output instead.

## Pattern: separate handled failures from unhandled failures

Use one test for `Catch` behavior and another for rejection.

```ts
it('returns recovery output when the task is caught', async () => {
  const result = await run(
    {
      definition: caughtDefinition,
      resourceContext: {
        invoke: async () => {
          throw new Error('boom');
        },
      },
    },
    {}
  );

  expect(result).toMatchObject({
    recovery: true,
  });
});

it('rejects when the task error is not caught', async () => {
  await expect(
    run(
      {
        definition: uncaughtDefinition,
        resourceContext: {
          invoke: async () => {
            throw new Error('boom');
          },
        },
      },
      {}
    )
  ).rejects.toThrow('boom');
});
```

## Pattern: keep local and AWS-backed tests in different jobs

Local tests answer: "Does my workflow logic do what I expect with controlled inputs and mocked resources?"

AWS-backed checks answer: "Does this workflow behave the way managed Step Functions behaves for this feature set and edge case?"

Use local tests for most scenarios because they are fast and precise. Add AWS-backed checks for compatibility-sensitive flows, uncommon ASL features, and final confidence before depending on managed behavior.
