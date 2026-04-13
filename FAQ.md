# Frequently Asked Questions

## General Questions

### Q: What is Tiny ASL Machine?
**A:** Tiny ASL Machine is a lightweight, TypeScript-based interpreter for AWS Step Functions' Amazon States Language (ASL). It lets you run and test state machines locally without AWS Step Functions, making it perfect for unit testing and local development.

### Q: Is this a replacement for AWS Step Functions?
**A:** No. This is **not** a production replacement. It's designed for:
- Local testing and development
- Unit testing with mocks
- Validating state machine logic

For production workloads, use AWS Step Functions.

### Q: When should I use Tiny ASL Machine?
**Use it when you want to:**
- Unit test state machines before deployment
- Develop locally without AWS credentials
- Mock external services easily
- Test complex branching and error handling logic

### Q: When should I NOT use it?
- Production deployments → use AWS Step Functions
- Long-running async workflows → use Step Functions Task Tokens
- Need state persistence → use Step Functions
- Require AWS service integration → use Step Functions

---

## Installation & Setup

### Q: How do I install it?
**A:**
```bash
npm install tiny-asl-machine
# or
pnpm add tiny-asl-machine
# or  
yarn add tiny-asl-machine
```

### Q: What are the dependencies?
**A:** Very few! Only `jsonpath` for JSONPath queries. No heavy AWS SDKs needed.

### Q: Do I need AWS credentials?
**A:** No! That's the whole point. You mock resources locally.

### Q: What Node.js versions are supported?
**A:** Node.js 14+ (TypeScript 5+). Check package.json for exact versions.

---

## Usage Questions

### Q: How do I mock a Lambda function?
**A:**
```typescript
const definition = {
  StartAt: 'CallLambda',
  States: {
    CallLambda: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction',
      End: true,
    },
  },
};

const mockFunction = async (input) => {
  return { result: 'mocked response', ...input };
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resourceName, payload) => {
        if (resourceName === 'arn:aws:lambda:us-east-1:123456789012:function:MyFunction') {
          return mockFunction(payload);
        }
      },
    },
  },
  inputData
);
```

### Q: How do I test error scenarios?
**A:** Use Catch blocks and throw errors in mocks:

```typescript
const mockFunction = vi.fn()
  .mockRejectedValueOnce(new Error('Connection timeout'))
  .mockResolvedValueOnce({ data: 'success' });

const definition = {
  StartAt: 'MyTask',
  States: {
    MyTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:MyFunction',
      Catch: [
        {
          ErrorEquals: ['Error'],
          Next: 'HandleError',
        },
      ],
    },
    HandleError: {
      Type: 'Pass',
      Result: 'Error handled',
      End: true,
    },
  },
};
```

### Q: How do I test Choice states?
**A:** Run with different inputs and check which path is taken:

```typescript
const definition = {
  StartAt: 'CheckStatus',
  States: {
    CheckStatus: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.status',
          StringEquals: 'active',
          Next: 'ProcessActive',
        },
        {
          Variable: '$.status',
          StringEquals: 'inactive',
          Next: 'ProcessInactive',
        },
      ],
    },
    ProcessActive: { Type: 'Pass', Result: 'Active', End: true },
    ProcessInactive: { Type: 'Pass', Result: 'Inactive', End: true },
  },
};

// Test active path
let result = await run({ definition }, { status: 'active' });
expect(result).toBe('Active');

// Test inactive path
result = await run({ definition }, { status: 'inactive' });
expect(result).toBe('Inactive');
```

### Q: How do I test Wait states without actually waiting?
**A:** Use fake timers with your test framework (vitest, jest, etc.):

```typescript
import { vi } from 'vitest';

it('should wait the correct duration', async () => {
  vi.useFakeTimers();
  
  const definition = {
    StartAt: 'WaitState',
    States: {
      WaitState: {
        Type: 'Wait',
        Seconds: 300,
        Next: 'Done',
      },
      Done: { Type: 'Succeed' },
    },
  };
  
  const promise = run({ definition }, {});
  
  // Fast-forward time
  vi.advanceTimersByTime(300000);
  
  const result = await promise;
  expect(result).toBeDefined();
  
  vi.useRealTimers();
});
```

### Q: How do I test Map states?
**A:**
```typescript
const definition = {
  StartAt: 'ProcessAll',
  States: {
    ProcessAll: {
      Type: 'Map',
      ItemsPath: '$.items',
      Iterator: {
        StartAt: 'ProcessItem',
        States: {
          ProcessItem: {
            Type: 'Pass',
            Result: 'processed',
            End: true,
          },
        },
      },
      End: true,
    },
  },
};

const result = await run(
  { definition },
  { items: ['item1', 'item2', 'item3'] }
);

// Result is array of results
expect(result).toHaveLength(3);
expect(result[0]).toBe('processed');
```

### Q: How do I use InputPath/OutputPath?
**A:**
```typescript
const definition = {
  StartAt: 'Transform',
  States: {
    Transform: {
      Type: 'Pass',
      InputPath: '$.user',  // Only pass user object
      OutputPath: '$.name', // Only return name
      End: true,
    },
  },
};

const result = await run(
  { definition },
  {
    user: { name: 'Alice', age: 30 },
    meta: { timestamp: '2024-01-01' },
  }
);

expect(result).toBe('Alice'); // Only the name
```

### Q: How do I use ResultPath?
**A:**
```typescript
const definition = {
  StartAt: 'Task1',
  States: {
    Task1: {
      Type: 'Pass',
      Result: { computed: true },
      ResultPath: '$.result',  // Place at $.result
      Next: 'Done',
    },
    Done: { Type: 'Succeed' },
  },
};

const result = await run(
  { definition },
  { original: 'data' }
);

// Result merges original input with computed result
expect(result).toEqual({
  original: 'data',
  result: { computed: true },
});
```

### Q: How do I use Parameters?
**A:**
```typescript
const definition = {
  StartAt: 'Task1',
  States: {
    Task1: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:MyFunction',
      Parameters: {
        'name.$': '$.user.name',      // Copy from input
        'age.$': '$.user.age',
        'timestamp': '2024-01-01',    // Static value
        'custom.$': "States.Format('User: {}', $.user.name)",
      },
      End: true,
    },
  },
};

const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (_, params) => params,
    },
  },
  { user: { name: 'Bob', age: 25 } }
);

expect(result.custom).toBe('User: Bob');
```

---

## Features & Compatibility

### Q: Which ASL features are supported?
**A:** See [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md) for a detailed breakdown.

**Fully supported:**
- ✅ All 8 state types
- ✅ 30+ choice operators
- ✅ InputPath/OutputPath/ResultPath
- ✅ Parameters with intrinsic functions
- ✅ Catch blocks
- ✅ 4 intrinsic functions (Format, JsonToString, StringToJson, Array)

**Coming soon:**
- ⏳ Retry logic (exponential backoff)
- ⏳ More intrinsic functions (Hash, UUID, Date operations)
- ⏳ Task Token pattern
- ⏳ Execution snapshots

### Q: Is Retry logic supported?
**A:** The structure is defined but logic not yet implemented. It's on the [roadmap](ROADMAP.md) for v0.1.0. You can already define Retry blocks, but they won't execute yet.

### Q: What intrinsic functions are available?
**A:**
- ✅ `States.Format(template, value1, value2, ...)`
- ✅ `States.JsonToString(value)`
- ✅ `States.StringToJson(jsonString)`
- ✅ `States.Array(item1, item2, ...)`

Coming soon:
- ⏳ `States.Hash.SHA256(input)`
- ⏳ `States.UUID()`
- ⏳ `States.Now()`

See [ROADMAP.md](ROADMAP.md) for timeline.

### Q: Can I use heartbeat/timeout?
**A:** TimeoutSeconds and HeartbeatSeconds fields are parsed but not enforced at runtime. They won't interrupt execution. For testing, use fake timers.

### Q: Does it support Task Tokens?
**A:** Not yet. This is planned for future versions. For now, mocks must respond synchronously.

---

## Testing Questions

### Q: What testing framework should I use?
**A:** Any framework that supports async tests:
- **Vitest** (recommended) - Fast, lightweight, great for AWS projects
- **Jest** - Popular, feature-rich
- **Mocha** - Simple, flexible
- **Node test runner** - Built-in (Node 18+)

### Q: How do I use it with Vitest?
**A:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { run } from 'tiny-asl-machine';

describe('my state machine', () => {
  it('should process data correctly', async () => {
    const mock = vi.fn().mockResolvedValue({ result: 'ok' });
    
    const definition = { /* ... */ };
    
    const result = await run(
      {
        definition,
        resourceContext: {
          invoke: mock,
        },
      },
      { input: 'data' }
    );
    
    expect(mock).toHaveBeenCalled();
    expect(result.result).toBe('ok');
  });
});
```

### Q: How do I handle multiple sequential calls?
**A:**
```typescript
const mock = vi.fn()
  .mockResolvedValueOnce({ step: 1 })
  .mockResolvedValueOnce({ step: 2 })
  .mockResolvedValueOnce({ step: 3 });

// Or with implementation
const mock = vi.fn().mockImplementation(async (input) => {
  if (input.action === 'validate') return { valid: true };
  if (input.action === 'process') return { processed: true };
  if (input.action === 'finalize') return { done: true };
});
```

### Q: How do I test all branches?
**A:**
```typescript
const testCases = [
  { input: { value: 10 }, expected: 'Low' },
  { input: { value: 100 }, expected: 'Medium' },
  { input: { value: 1000 }, expected: 'High' },
];

for (const { input, expected } of testCases) {
  it(`handles ${expected}`, async () => {
    const result = await run({ definition }, input);
    expect(result).toBe(expected);
  });
}
```

### Q: How do I debug failing tests?
**A:**

1. **Enable debug output:**
```typescript
import Debug from 'debug';
Debug.enable('tiny-asl-machine:*');
```

2. **Add logging:**
```typescript
const mock = vi.fn().mockImplementation(async (input) => {
  console.log('Mock called with:', input);
  return { result: 'ok' };
});
```

3. **Check state machine definition:**
```typescript
console.log(JSON.stringify(definition, null, 2));
```

4. **Validate the definition:**
- Make sure all Next states exist
- Make sure InputPath/OutputPath are valid JSONPath
- Make sure Parameters syntax is correct

---

## Performance Questions

### Q: How fast is it?
**A:** Very! Unit tests typically run in milliseconds. The library is optimized for testing, not production workloads.

### Q: Can it handle large state machines?
**A:** Yes, but complexity matters more than size:
- Simple sequential states: very fast
- Complex nested Parallel/Map: slower
- Number of mock calls: affects performance

### Q: Can I run many tests in parallel?
**A:** Yes, since each test creates fresh mocks and context. No shared state.

---

## Troubleshooting

### Q: I get "State '...' not found"
**A:** Check your Next/Default state names match exactly.

```typescript
// ❌ WRONG - state name is 'NextState'
{ Type: 'Pass', Next: 'Next' }

// ✅ CORRECT
{ Type: 'Pass', Next: 'NextState' }
States: {
  NextState: { /* ... */ }
}
```

### Q: My Choice rule isn't matching
**A:** Debug step by step:
```typescript
const debug = Debug('test');
debug('Input:', input);
debug('Variable value:', selectPath('$.status', input));
debug('Expected:', 'active');
```

Check:
1. Variable path is correct
2. Input actually contains the path
3. Operator name is spelled right
4. Type matches (string vs number)

### Q: My mock isn't being called
**A:** Ensure resource name matches exactly:

```typescript
// In definition
Resource: 'arn:aws:lambda:us-east-1:123456789012:function:MyFunc'

// In mock
invoke: async (resourceName, payload) => {
  console.log('Called with:', resourceName); // Debug this
  if (resourceName === 'arn:aws:lambda:us-east-1:123456789012:function:MyFunc') {
    return mockFunc(payload);
  }
}
```

### Q: ResultPath isn't merging correctly
**A:** ResultPath syntax is important:

```typescript
// Merge at path
ResultPath: '$.result'

// Append to root (works like $ root object merge)
ResultPath: '$'

// Discard result
ResultPath: null
ResultPath: undefined

// ❌ DON'T use both:
// ResultPath: '$.result'
// AND next statement expects result at root
```

### Q: Catch isn't catching my error
**A:** Error type matching matters:

```typescript
// Thrown error
throw new Error('message') // name is 'Error'

// Catch must match
Catch: [
  {
    ErrorEquals: ['Error'],  // Matches
    Next: 'Handler',
  },
  {
    ErrorEquals: ['CustomError'],  // Doesn't match
    Next: 'Other',
  },
]
```

---

## Contributing Questions

### Q: How can I help?
**A:** See [CONTRIBUTING.md](CONTRIBUTING.md) for details. Most needed:
- Retry logic implementation
- More intrinsic functions
- Better error messages
- More tests
- Documentation improvements

### Q: Is there a roadmap?
**A:** Yes! Check [ROADMAP.md](ROADMAP.md) for priorities and timeline.

### Q: How do I report bugs?
**A:** Create a GitHub issue with:
1. What you tried
2. What happened
3. What you expected
4. Your state machine (sanitized)
5. Versions (Node, npm, tiny-asl-machine)

---

## Getting More Help

- 📖 [README.md](README.md) - Usage guide
- 🔍 [ASL_COMPATIBILITY.md](ASL_COMPATIBILITY.md) - Technical details
- 🤝 [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
- 📚 [EXAMPLES.md](EXAMPLES.md) - Code examples
- 🗺️ [ROADMAP.md](ROADMAP.md) - Future plans
- 💬 [GitHub Discussions](https://github.com/gabrielmoreira/tiny-asl-machine/discussions)
- 🐛 [GitHub Issues](https://github.com/gabrielmoreira/tiny-asl-machine/issues)

---

**Last Updated**: February 2025

Can't find your answer? [Open an issue](https://github.com/gabrielmoreira/tiny-asl-machine/issues) or [start a discussion](https://github.com/gabrielmoreira/tiny-asl-machine/discussions)!
