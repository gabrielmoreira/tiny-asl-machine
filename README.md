# 🎯 Tiny ASL Machine

A lightweight TypeScript interpreter for AWS Step Functions' Amazon States Language (ASL).

**Perfect for:** Unit testing Step Functions state machines locally  
**Not for:** Production execution, persistent state, AWS service integration

[![npm version](https://badge.fury.io/js/tiny-asl-machine.svg)](https://badge.fury.io/js/tiny-asl-machine)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Installation

```bash
npm install tiny-asl-machine
pnpm add tiny-asl-machine
yarn add tiny-asl-machine
```

## Quick Start

```typescript
import { run } from 'tiny-asl-machine';

// Define your state machine
const definition = {
  StartAt: 'MyTask',
  States: {
    MyTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:MyFunction',
      End: true,
    },
  },
};

// Mock your Lambda
const result = await run(
  {
    definition,
    resourceContext: {
      invoke: async (resource, input) => {
        return { processed: true, ...input };
      },
    },
  },
  { data: 'test' }
);
```

## 📚 Examples

### Choice State

```typescript
const definition = {
  StartAt: 'CheckAmount',
  States: {
    CheckAmount: {
      Type: 'Choice',
      Choices: [
        { Variable: '$.amount', NumericGreaterThan: 1000, Next: 'HighValue' },
      ],
      Default: 'Standard',
    },
    HighValue: { Type: 'Pass', Result: 'Needs approval', End: true },
    Standard: { Type: 'Pass', Result: 'Auto-approved', End: true },
  },
};
```

### Parallel Execution

```typescript
const definition = {
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

### Map (Array Iteration)

```typescript
const definition = {
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
            Resource: 'arn:aws:lambda:function:ProcessItem',
            End: true,
          },
        },
      },
      End: true,
    },
  },
};
```

### Error Handling with Catch

```typescript
const definition = {
  StartAt: 'RiskyTask',
  States: {
    RiskyTask: {
      Type: 'Task',
      Resource: 'arn:aws:lambda:function:Risky',
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

## 🚀 Same JSON for Tests & Production

**Key Property:** The tool accepts any string as a resource name. This means you can use your existing state machine JSON from your codebase or exported from AWS without modification.

### Scenario 1: With Placeholders (Development)

If your project uses placeholders that get replaced at deploy time:

```json
// stateMachine.json (in your codebase)
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
      "Choices": [
        { "Variable": "$.status", "StringEquals": "approved", "Next": "Success" }
      ],
      "Default": "Fail"
    },
    "Success": { "Type": "Succeed" }
  }
}
```

```typescript
// test.spec.ts - Mock the placeholder string as-is
import definition from './stateMachine.json';

it('should process approved payment', async () => {
  const result = await run(
    {
      definition,
      resourceContext: {
        invoke: async (resource) => {
          if (resource === '{myPaymentLambdaArn}') {
            return { status: 'approved', txnId: 'TXN-123' };
          }
        },
      },
    },
    { amount: 100 }
  );

  expect(result.status).toBe('approved');
});
```

Your CI/CD pipeline replaces `{myPaymentLambdaArn}` with the actual ARN before deployment.

### Scenario 2: Export from AWS Console

Export your deployed state machine directly from AWS console (ARNs are already resolved):

```json
// stateMachine-deployed.json (exported from AWS console)
{
  "StartAt": "ProcessPayment",
  "States": {
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment",
      "Next": "ValidateResult"
    },
    ...
  }
}
```

```typescript
// test.spec.ts - Mock the actual ARN string
import definition from './stateMachine-deployed.json';

it('should process approved payment', async () => {
  const result = await run(
    {
      definition,
      resourceContext: {
        invoke: async (resource) => {
          if (resource === 'arn:aws:lambda:us-east-1:123456789012:function:ProcessPayment') {
            return { status: 'approved', txnId: 'TXN-123' };
          }
        },
      },
    },
    { amount: 100 }
  );

  expect(result.status).toBe('approved');
});
```

**Why this works great:**
- ✅ The tool accepts any string as a resource name
- ✅ No need to maintain separate test/prod JSON versions
- ✅ Use your production JSON file (with placeholders or real ARNs) directly in tests
- ✅ Mock whatever resource string is in your definition - placeholder or ARN
- ✅ Export from AWS console and test immediately (after anonymizing sensitive values if prod)

## 📋 Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Task** | ✅ | Resource invocation, Parameters, ResultPath |
| **Pass** | ✅ | Data transformation, Result field |
| **Choice** | ✅ | All 30+ operators (String, Numeric, Boolean, Timestamp) |
| **Wait** | ✅ | Seconds, Timestamp, SecondsPath |
| **Parallel** | ✅ | Concurrent branch execution |
| **Map** | ✅ | Array iteration with MaxConcurrency |
| **Succeed** | ✅ | Terminal success state |
| **Fail** | ✅ | Terminal failure state |
| **Catch** | ✅ | Error handling blocks |
| **Retry** | 🚧 | Structure defined, logic pending |
| **InputPath/OutputPath** | ✅ | JSONPath filtering |
| **ResultPath** | ✅ | Result merging |
| **Parameters** | ✅ | Dynamic field mapping, Intrinsic Functions |
| **Intrinsic Functions** | 🚧 | 4 of 10 implemented (Format, StringToJson, JsonToString, Array) |
| **Task Tokens** | 🚧 | Not yet implemented |
| **State Persistence** | ❌ | Not supported |

**Overall:** ~75-80% ASL compatible. Covers most common testing use cases.

## 🎯 Real-World Example

We've tested this library with a [test based on AWS's official ETL orchestration sample](tests/sampleETLOrchestration.spec.ts), demonstrating it can execute [complex ASL definitions](https://github.com/aws-samples/getting-started-with-amazon-redshift-data-api/tree/main/use-cases/etl-orchestration-with-step-functions).

The test demonstrates:
- Multiple Task states with resource invocation
- Choice branching for conditional logic
- Wait states for polling patterns
- Parallel execution
- Error handling with Catch blocks

See the test to understand how realistic state machines can be tested.

## 💡 Ideas for Contribution

Beyond bug fixes and core features, there are some interesting opportunities:

- **CLI tool** - Analyze state machine JSON and generate typed test stubs with all Task resources automatically extracted and mocked
- **AI-powered test generation** - Generate LLM prompts to help create comprehensive test scenarios from a state machine definition
- **AWS fidelity** - Implement all remaining intrinsic functions and known behaviors to create a fully trustworthy testing motor that matches AWS Step Functions

## 🤝 Contributing

We welcome contributions! The codebase is simple and easy to extend:

- **Bug fixes** - Found an issue? Submit a PR
- **Feature implementation** - Implement missing intrinsic functions or Retry logic
- **Tests** - Add edge case coverage
- **Documentation** - Improve examples

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

## 🚫 What's NOT Supported

- Production execution (not persistent, not real AWS integration)
- Task Token async patterns
- State persistence or pause/resume
- Database connections

**Use AWS Step Functions for production workloads.**

## 📄 License

MIT - See [LICENSE](LICENSE)

## 📚 Resources

- 📖 [Examples & Patterns](EXAMPLES.md)
- ❓ [FAQ](FAQ.md)
- 🔧 [ASL Compatibility Details](ASL_COMPATIBILITY.md)
- 🤝 [Contributing Guide](CONTRIBUTING.md)
- 🐛 [Report Issues](https://github.com/gabrielmoreira/tiny-asl-machine/issues)
