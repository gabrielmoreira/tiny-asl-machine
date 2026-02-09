# Examples Directory

This directory contains practical examples of how to use Tiny ASL Machine for testing Step Functions state machines.

## File Organization

- **simple-examples/** - Basic usage patterns
- **real-world-examples/** - Complex production-like scenarios
- **testing-patterns/** - Common testing approaches
- **advanced-features/** - Less common but powerful patterns

## Quick Start Examples

### 1. Simple Pass-Through State

```typescript
import { run } from 'tiny-asl-machine';

const definition = {
  Comment: 'A minimal state machine',
  StartAt: 'PassThrough',
  States: {
    PassThrough: {
      Type: 'Pass',
      End: true,
    },
  },
};

const result = await run({ definition }, { message: 'Hello' });
// Result: { message: 'Hello' }
```

### 2. Task with Mocked Service

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const mockPaymentService = vi.fn().mockResolvedValue({ 
  transactionId: 'TXN-123',
  status: 'approved' 
});

const definition = {
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

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment') {
          return mockPaymentService(payload);
        }
      },
    },
  },
  { orderId: 'ORD-123', amount: 99.99 }
);

// Result: { 
//   orderId: 'ORD-123', 
//   amount: 99.99,
//   transaction: { transactionId: 'TXN-123', status: 'approved' }
// }
```

### 3. Choice State with Branching

```typescript
import { run } from 'tiny-asl-machine';

const definition = {
  StartAt: 'CheckAmount',
  States: {
    CheckAmount: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.amount',
          NumericGreaterThan: 1000,
          Next: 'HighValueOrder',
        },
        {
          Variable: '$.amount',
          NumericGreaterThanEquals: 100,
          Next: 'StandardOrder',
        },
      ],
      Default: 'SmallOrder',
    },
    HighValueOrder: {
      Type: 'Pass',
      Result: 'Requires approval',
      End: true,
    },
    StandardOrder: {
      Type: 'Pass',
      Result: 'Auto-approved',
      End: true,
    },
    SmallOrder: {
      Type: 'Pass',
      Result: 'Direct shipment',
      End: true,
    },
  },
};

// Test each branch
expect(await run({ definition }, { amount: 5000 })).toBe('Requires approval');
expect(await run({ definition }, { amount: 500 })).toBe('Auto-approved');
expect(await run({ definition }, { amount: 25 })).toBe('Direct shipment');
```

### 4. Error Handling with Catch

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const mockRiskyService = vi.fn()
  .mockRejectedValueOnce(new Error('Database connection failed'))
  .mockResolvedValueOnce({ data: 'success' });

const definition = {
  StartAt: 'AttemptTask',
  States: {
    AttemptTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:Risky',
      Catch: [
        {
          ErrorEquals: ['Error'],
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
        'retryMessage': 'Operation failed, will retry',
      },
      End: true,
    },
  },
};

// First call fails, caught
const result1 = await run(
  {
    definition,
    resourceContext: {
      invoke: mockRiskyService,
    },
  },
  {}
);

expect(result1.error.Error).toBe('Error');
expect(result1.error.Cause).toBe('Database connection failed');
```

### 5. Map State for Batch Processing

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const mockProcessor = vi.fn()
  .mockImplementation(async (item) => ({
    ...item,
    processed: true,
    timestamp: new Date().toISOString(),
  }));

const definition = {
  StartAt: 'ProcessBatch',
  States: {
    ProcessBatch: {
      Type: 'Map',
      ItemsPath: '$.items',
      MaxConcurrency: 2,
      Iterator: {
        StartAt: 'ProcessItem',
        States: {
          ProcessItem: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:function:ProcessItem',
            End: true,
          },
        },
      },
      ResultPath: '$.results',
      Next: 'Success',
    },
    Success: {
      Type: 'Succeed',
    },
  },
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: mockProcessor,
    },
  },
  {
    items: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ],
  }
);

// Check all items were processed
expect(result.results).toHaveLength(3);
expect(result.results[0].processed).toBe(true);
expect(mockProcessor).toHaveBeenCalledTimes(3);
```

### 6. Parallel Execution

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const mockBranchA = vi.fn().mockResolvedValue({ branch: 'A', result: 'Success' });
const mockBranchB = vi.fn().mockResolvedValue({ branch: 'B', result: 'Success' });

const definition = {
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
              Resource: 'arn:aws:lambda:function:BranchA',
              End: true,
            },
          },
        },
        {
          StartAt: 'BranchB',
          States: {
            BranchB: {
              Type: 'Task',
              Resource: 'arn:aws:lambda:function:BranchB',
              End: true,
            },
          },
        },
      ],
      End: true,
    },
  },
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource === 'arn:aws:lambda:function:BranchA') return mockBranchA();
        if (resource === 'arn:aws:lambda:function:BranchB') return mockBranchB();
      },
    },
  },
  {}
);

// Both branches execute in parallel
expect(mockBranchA).toHaveBeenCalled();
expect(mockBranchB).toHaveBeenCalled();
expect(result).toEqual([
  [{ branch: 'A', result: 'Success' }],
  [{ branch: 'B', result: 'Success' }],
]);
```

### 7. Wait State

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const definition = {
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

// Use fake timers for testing
vi.useFakeTimers();
vi.spyOn(globalThis, 'setTimeout');

const promise = run({ definition }, {});

// Advance time
vi.advanceTimersByTime(5000);

const result = await promise;
expect(result).toBe('Done waiting');

vi.useRealTimers();
```

### 8. Intrinsic Functions

```typescript
import { run } from 'tiny-asl-machine';

const definition = {
  StartAt: 'UseIntrinsics',
  States: {
    UseIntrinsics: {
      Type: 'Pass',
      Parameters: {
        'greeting.$': "States.Format('Hello, {}!', $.name)",
        'jsonString.$': "States.JsonToString($.data)",
        'parsed.$': "States.StringToJson($.jsonInput)",
        'items.$': "States.Array($.first, $.second, $.third)",
      },
      End: true,
    },
  },
};

const result = await run({ definition }, {
  name: 'Alice',
  data: { user: 'bob', role: 'admin' },
  jsonInput: '{"x":1,"y":2}',
  first: 'a',
  second: 'b',
  third: 'c',
});

expect(result.greeting).toBe('Hello, Alice!');
expect(result.jsonString).toBe('{"user":"bob","role":"admin"}');
expect(result.parsed).toEqual({ x: 1, y: 2 });
expect(result.items).toEqual(['a', 'b', 'c']);
```

### 9. Complex Real-World Example: Order Processing

```typescript
import { run } from 'tiny-asl-machine';
import { vi } from 'vitest';

const definition = {
  Comment: 'Process an e-commerce order',
  StartAt: 'ValidateOrder',
  States: {
    ValidateOrder: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:ValidateOrder',
      Next: 'IsValid',
      Catch: [
        {
          ErrorEquals: ['ValidationError'],
          Next: 'OrderRejected',
          ResultPath: '$.validationError',
        },
      ],
    },
    IsValid: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.isValid',
          BooleanEquals: true,
          Next: 'ProcessPayment',
        },
      ],
      Default: 'OrderRejected',
    },
    ProcessPayment: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:ProcessPayment',
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 2.0,
        },
      ],
      Catch: [
        {
          ErrorEquals: ['PaymentFailed'],
          Next: 'OrderRejected',
          ResultPath: '$.paymentError',
        },
      ],
      ResultPath: '$.payment',
      Next: 'FulfillOrder',
    },
    FulfillOrder: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:FulfillOrder',
      End: true,
    },
    OrderRejected: {
      Type: 'Fail',
      Error: 'OrderRejected',
      Cause: 'Order could not be processed',
    },
  },
};

// Test successful order
const mockValidate = vi.fn().mockResolvedValue({ isValid: true });
const mockPayment = vi.fn().mockResolvedValue({ status: 'approved', txnId: 'TXN123' });
const mockFulfill = vi.fn().mockResolvedValue({ shippingId: 'SHIP123' });

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, payload) => {
        if (resource.includes('ValidateOrder')) return mockValidate(payload);
        if (resource.includes('ProcessPayment')) return mockPayment(payload);
        if (resource.includes('FulfillOrder')) return mockFulfill(payload);
      },
    },
  },
  {
    orderId: 'ORD-001',
    customerId: 'CUST-123',
    items: [{ sku: 'ITEM1', qty: 2 }],
    total: 99.99,
  }
);

expect(result.payment.status).toBe('approved');
expect(result.shippingId).toBe('SHIP123');
```

## Running the Examples

```bash
# All examples (they're in tests/)
pnpm test

# Specific example
pnpm test -- --grep "Order Processing"

# Watch mode
pnpm test:watch
```

## Learning Path

Start with these in order:

1. ✅ Simple Pass-Through (understand basic structure)
2. ✅ Task with Mock (understand mocking pattern)
3. ✅ Choice State (understand branching)
4. ✅ Error Handling (understand Catch blocks)
5. ✅ Map State (understand iteration)
6. ✅ Parallel (understand concurrency)
7. ✅ Wait State (understand timing)
8. ✅ Intrinsic Functions (understand transformations)
9. ✅ Complex Example (understand real patterns)

## Tips for Success

1. **Test one behavior at a time** - Use separate test cases
2. **Mock external dependencies** - Focus on state machine logic
3. **Use clear variable names** - Makes tests readable
4. **Document your assumptions** - Help future maintainers
5. **Test error paths** - Not just happy paths

## Common Patterns

### Mocking Multiple Calls
```typescript
const mock = vi.fn()
  .mockResolvedValueOnce({ status: 'pending' })
  .mockResolvedValueOnce({ status: 'complete' });
```

### Testing Conditionals
```typescript
const definition = { /* state machine */ };

// Test each branch
for (const value of [10, 100, 1000]) {
  const result = await run({ definition }, { amount: value });
  // Assert for each value
}
```

### Fake Timers for Wait
```typescript
vi.useFakeTimers();
const promise = run({ definition }, {});
vi.advanceTimersByTime(5000);
const result = await promise;
vi.useRealTimers();
```

---

**For more information, see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md)**
