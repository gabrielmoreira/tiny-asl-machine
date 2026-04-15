import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.Parameters';

const expectOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual(output);
};

export const featureParametersCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-reshapes-input-object',
    title: 'builds a new payload template from dynamic and static fields',
    group,
    tags: ['happy_path', 'parameters'],
    definition: {
      StartAt: 'Reshape',
      States: {
        Reshape: {
          Type: 'Pass',
          Parameters: {
            request: {
              'customerId.$': '$.customer.id',
              'customerName.$': '$.customer.name',
            },
            item: {
              'sku.$': '$.item.sku',
              'quantity.$': '$.item.quantity',
            },
            priority: 'high',
            'expedite.$': '$.flags.expedite',
          },
          End: true,
        },
      },
    },
    input: {
      customer: {
        id: 'cust-1',
        name: 'Ada',
      },
      item: {
        sku: 'sku-9',
        quantity: 3,
      },
      flags: {
        expedite: true,
      },
      ignored: 'value',
    },
    expected: expectOutput({
      request: {
        customerId: 'cust-1',
        customerName: 'Ada',
      },
      item: {
        sku: 'sku-9',
        quantity: 3,
      },
      priority: 'high',
      expedite: true,
    }),
    source: {
      notes: 'Focuses on payload-template construction rather than any specific state behavior.',
    },
  }),
  customDefinitionCase({
    id: '002-only-dot-keys-resolve-paths',
    title: 'evaluates only keys ending in dot-dollar while preserving plain strings literally',
    group,
    tags: ['happy_path', 'parameters', 'literal_vs_dynamic'],
    definition: {
      StartAt: 'ResolveTemplate',
      States: {
        ResolveTemplate: {
          Type: 'Pass',
          Parameters: {
            literal: '$.customer.name',
            'resolved.$': '$.customer.name',
            nested: {
              literal: '$.flags.active',
              'resolved.$': '$.flags.active',
            },
          },
          End: true,
        },
      },
    },
    input: {
      customer: {
        name: 'Grace',
      },
      flags: {
        active: true,
      },
    },
    expected: expectOutput({
      literal: '$.customer.name',
      resolved: 'Grace',
      nested: {
        literal: '$.flags.active',
        resolved: true,
      },
    }),
    source: {
      notes:
        'Captures the defining Parameters suffix rule directly, including nested payload-template objects.',
    },
  }),
  customDefinitionCase({
    id: '003-can-read-current-and-context-data',
    title: 'combines current-input paths with execution-context paths in one payload template',
    group,
    tags: ['happy_path', 'parameters', 'context'],
    definition: {
      StartAt: 'ComposeTemplate',
      States: {
        ComposeTemplate: {
          Type: 'Pass',
          Parameters: {
            'payload.$': '$.payload',
            'requestId.$': '$$.Execution.Input.requestId',
            'original.$': '$$.Execution.Input',
            metadata: {
              source: 'context',
            },
          },
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-55',
      payload: {
        orderId: 'ord-1',
        total: 42,
      },
      region: 'us-east-1',
    },
    expected: expectOutput({
      payload: {
        orderId: 'ord-1',
        total: 42,
      },
      requestId: 'req-55',
      original: {
        requestId: 'req-55',
        payload: {
          orderId: 'ord-1',
          total: 42,
        },
        region: 'us-east-1',
      },
      metadata: {
        source: 'context',
      },
    }),
    source: {
      notes:
        'Uses execution context in a compact way without depending on state-specific resource behavior.',
    },
  }),
];
