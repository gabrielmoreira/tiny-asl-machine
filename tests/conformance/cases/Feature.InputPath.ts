import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.InputPath';
const localEchoResource = 'local:feature:input-path:echo';

const expectOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual(output);
};

export const featureInputPathCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-selects-nested-input',
    title: 'selects a nested branch as the effective state input',
    group,
    tags: ['happy_path', 'input_path', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses a local echo task so the catalog can assert the exact effective input delivered into state execution.',
    definition: {
      StartAt: 'InvokeSelected',
      States: {
        InvokeSelected: {
          Type: 'Task',
          Resource: localEchoResource,
          InputPath: '$.payload.order',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-1',
      payload: {
        order: {
          id: 'ord-9',
          quantity: 2,
        },
      },
      ignored: {
        id: 'wrong-order',
      },
    },
    setupLocalResources: () => ({
      [localEchoResource]: payload => payload,
    }),
    expected: expectOutput({
      id: 'ord-9',
      quantity: 2,
    }),
    source: {
      notes:
        'Catalogs InputPath as an effective-input selector independently from any output shaping.',
    },
  }),
  customDefinitionCase({
    id: '002-null-inputpath-preserves-input-locally',
    title: 'documents the current local behavior where InputPath null preserves the incoming input',
    group,
    tags: ['boundary', 'input_path', 'null', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Current local runtime only applies InputPath when it is a string, so null is effectively ignored here; keep this as a documented local behavior until broader path feature parity work changes it.',
    definition: {
      StartAt: 'InvokeNull',
      States: {
        InvokeNull: {
          Type: 'Task',
          Resource: localEchoResource,
          InputPath: null as unknown as undefined,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-2',
      payload: {
        ignored: true,
      },
    },
    setupLocalResources: () => ({
      [localEchoResource]: payload => payload,
    }),
    expected: expectOutput({
      requestId: 'req-2',
      payload: {
        ignored: true,
      },
    }),
    source: {
      notes:
        'This intentionally captures the current local runtime caveat: InputPath null is ignored because only string InputPath values are selected in src/states/index.ts.',
    },
  }),
  customDefinitionCase({
    id: '003-inputpath-before-parameters',
    title: 'applies InputPath before Parameters reshape the task payload',
    group,
    tags: ['happy_path', 'input_path', 'parameters', 'context', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses a local echo task so the catalog can observe the payload after InputPath selection and Parameters reshaping.',
    definition: {
      StartAt: 'BuildRequest',
      States: {
        BuildRequest: {
          Type: 'Task',
          Resource: localEchoResource,
          InputPath: '$.request',
          Parameters: {
            'customerId.$': '$.customer.id',
            'sku.$': '$.item.sku',
            'quantity.$': '$.item.quantity',
            'traceId.$': '$$.Execution.Input.meta.traceId',
          },
          End: true,
        },
      },
    },
    input: {
      meta: {
        traceId: 'trace-9',
      },
      request: {
        customer: {
          id: 'cust-7',
        },
        item: {
          sku: 'sku-3',
          quantity: 4,
        },
      },
      customer: {
        id: 'outer-customer',
      },
    },
    setupLocalResources: () => ({
      [localEchoResource]: payload => payload,
    }),
    expected: expectOutput({
      customerId: 'cust-7',
      sku: 'sku-3',
      quantity: 4,
      traceId: 'trace-9',
    }),
    source: {
      notes:
        'Shows ordering semantics directly: Parameters resolve against the InputPath-selected data while context still comes from execution metadata.',
    },
  }),
];
