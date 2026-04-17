# Examples

Short, test-shaped examples for Tiny ASL Machine.

Use this file when you want fast patterns.
Use `tests/` for the full runnable cases.

## 1. Pass-through

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

// Given
const definition: StateDefinition = {
  StartAt: 'PassThrough',
  States: {
    PassThrough: {
      Type: 'Pass',
      End: true,
    },
  },
};
const input = { message: 'Hello' };

// When
const result = await run({ definition }, input);

// Then
expect(result).toEqual({ message: 'Hello' });
```

## 2. Task with a mocked resource

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import { vi } from 'vitest';

// Given
const definition: StateDefinition = {
  StartAt: 'ProcessPayment',
  States: {
    ProcessPayment: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment',
      ResultPath: '$.transaction',
      End: true,
    },
  },
};
const mockPaymentService = vi.fn().mockResolvedValue({
  transactionId: 'TXN-123',
  status: 'approved',
});
const input = { orderId: 'ORD-123', amount: 99.99 };

// When
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment') {
          return mockPaymentService(payload);
        }
        throw new Error(`Unexpected resource: ${resource}`);
      },
    },
  },
  input
);

// Then
expect(mockPaymentService).toHaveBeenCalledWith(input);
expect(result).toEqual({
  orderId: 'ORD-123',
  amount: 99.99,
  transaction: {
    transactionId: 'TXN-123',
    status: 'approved',
  },
});
```

## 3. Same lambda called twice with different responses

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import { vi } from 'vitest';

// Given
const definition: StateDefinition = {
  StartAt: 'FirstCall',
  States: {
    FirstCall: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:GetStatus',
      ResultPath: '$.first',
      Next: 'SecondCall',
    },
    SecondCall: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:GetStatus',
      ResultPath: '$.second',
      End: true,
    },
  },
};
const mockStatus = vi
  .fn()
  .mockResolvedValueOnce({ status: 'pending' })
  .mockResolvedValueOnce({ status: 'complete' });
const input = { orderId: 'ORD-123' };

// When
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async resource => {
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:GetStatus') {
          return mockStatus();
        }
        throw new Error(`Unexpected resource: ${resource}`);
      },
    },
  },
  input
);

// Then
expect(result).toEqual({
  orderId: 'ORD-123',
  first: { status: 'pending' },
  second: { status: 'complete' },
});
expect(mockStatus).toHaveBeenCalledTimes(2);
```

## 4. Choice branching

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

// Given
const definition: StateDefinition = {
  StartAt: 'CheckAmount',
  States: {
    CheckAmount: {
      Type: 'Choice',
      Choices: [
        { Variable: '$.amount', NumericGreaterThan: 1000, Next: 'HighValue' },
        { Variable: '$.amount', NumericGreaterThanEquals: 100, Next: 'Standard' },
      ],
      Default: 'Small',
    },
    HighValue: { Type: 'Pass', Result: 'Requires approval', End: true },
    Standard: { Type: 'Pass', Result: 'Auto-approved', End: true },
    Small: { Type: 'Pass', Result: 'Direct shipment', End: true },
  },
};

// When
const high = await run({ definition }, { amount: 5000 });
const standard = await run({ definition }, { amount: 500 });
const small = await run({ definition }, { amount: 25 });

// Then
expect(high).toBe('Requires approval');
expect(standard).toBe('Auto-approved');
expect(small).toBe('Direct shipment');
```

## 5. Catch for a handled failure

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

class PaymentRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRetryableError';
  }
}

// Given
const definition: StateDefinition = {
  StartAt: 'AttemptTask',
  States: {
    AttemptTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Risky',
      Catch: [
        {
          ErrorEquals: ['PaymentRetryableError'],
          Next: 'HandleError',
          ResultPath: '$.error',
        },
      ],
      End: true,
    },
    HandleError: {
      Type: 'Pass',
      Parameters: {
        'original.$': '$.error',
        retryMessage: 'Operation failed, will retry',
      },
      End: true,
    },
  },
};
const input = {};
// When
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async () => {
        throw new PaymentRetryableError('Database connection failed');
      },
    },
  },
  input
);

// Then
expect(result.original.Error).toBe('PaymentRetryableError');
expect(result.original.Cause).toBe('Database connection failed');
expect(result.retryMessage).toBe('Operation failed, will retry');
```

## 6. Map for batch processing

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import { vi } from 'vitest';

// Given
const definition: StateDefinition = {
  StartAt: 'ProcessBatch',
  States: {
    ProcessBatch: {
      Type: 'Map',
      ItemsPath: '$.items',
      Iterator: {
        StartAt: 'ProcessItem',
        States: {
          ProcessItem: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:ProcessItem',
            End: true,
          },
        },
      },
      ResultPath: '$.results',
      End: true,
    },
  },
};
const mockProcessor = vi.fn(async item => ({ ...item, processed: true }));
const input = {
  items: [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ],
};

// When
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (_, payload) => mockProcessor(payload),
    },
  },
  input
);

// Then
expect(mockProcessor).toHaveBeenCalledTimes(2);
expect(result.results).toEqual([
  { id: 1, name: 'Item 1', processed: true },
  { id: 2, name: 'Item 2', processed: true },
]);
```

## 7. Parallel execution

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';
import { vi } from 'vitest';

// Given
const definition: StateDefinition = {
  StartAt: 'ExecuteParallel',
  States: {
    ExecuteParallel: {
      Type: 'Parallel',
      Branches: [
        {
          StartAt: 'BranchA',
          States: {
            BranchA: {
              Type: 'Task',
              Resource: 'arn:aws:lambda:us-east-1:123456789012:function:BranchA',
              End: true,
            },
          },
        },
        {
          StartAt: 'BranchB',
          States: {
            BranchB: {
              Type: 'Task',
              Resource: 'arn:aws:lambda:us-east-1:123456789012:function:BranchB',
              End: true,
            },
          },
        },
      ],
      End: true,
    },
  },
};
const mockBranchA = vi.fn().mockResolvedValue({ branch: 'A', result: 'Success' });
const mockBranchB = vi.fn().mockResolvedValue({ branch: 'B', result: 'Success' });
const input = {};

// When
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async resource => {
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:BranchA') {
          return mockBranchA();
        }
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:BranchB') {
          return mockBranchB();
        }
        throw new Error(`Unexpected resource: ${resource}`);
      },
    },
  },
  input
);

// Then
expect(mockBranchA).toHaveBeenCalled();
expect(mockBranchB).toHaveBeenCalled();
expect(result).toEqual([
  { branch: 'A', result: 'Success' },
  { branch: 'B', result: 'Success' },
]);
```

## 8. Wait with deterministic runtime

```ts
import { createTestRuntime, run, type StateDefinition } from 'tiny-asl-machine';

// Given
const definition: StateDefinition = {
  StartAt: 'WaitBefore',
  States: {
    WaitBefore: {
      Type: 'Wait',
      Seconds: 5,
      Next: 'Complete',
    },
    Complete: {
      Type: 'Pass',
      Result: 'Done waiting',
      End: true,
    },
  },
};
const runtime = createTestRuntime();
const input = {};

// When
const result = await run({ definition, runtime }, input);

// Then
expect(result).toBe('Done waiting');
```

## 9. Intrinsic functions in Parameters

```ts
import { run, type StateDefinition } from 'tiny-asl-machine';

// Given
const definition: StateDefinition = {
  StartAt: 'UseIntrinsics',
  States: {
    UseIntrinsics: {
      Type: 'Pass',
      Parameters: {
        'greeting.$': "States.Format('Hello, {}!', $.name)",
        'jsonString.$': 'States.JsonToString($.data)',
        'parsed.$': 'States.StringToJson($.jsonInput)',
        'items.$': 'States.Array($.first, $.second, $.third)',
      },
      End: true,
    },
  },
};
const input = {
  name: 'Alice',
  data: { user: 'bob', role: 'admin' },
  jsonInput: '{"x":1,"y":2}',
  first: 'a',
  second: 'b',
  third: 'c',
};

// When
const result = await run({ definition }, input);

// Then
expect(result.greeting).toBe('Hello, Alice!');
expect(result.jsonString).toBe('{"user":"bob","role":"admin"}');
expect(result.parsed).toEqual({ x: 1, y: 2 });
expect(result.items).toEqual(['a', 'b', 'c']);
```

## Good next steps

- [README.md](README.md) for the main package overview
- [FAQ.md](FAQ.md) for short answers
- [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md) for support details
- `skills/write-local-state-machine-tests/SKILL.md` for a testing playbook
