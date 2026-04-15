import { expect } from 'vitest';
import {
  customDefinitionCase,
  multiExpressionCase,
  singleExpressionCase,
} from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONPath';
const sourceFile = 'tests/conformance/cases/Feature.JSONPath.ts';

const expectExpressionFailure =
  (options: { error?: string; causeIncludes?: string[] } = {}) =>
  (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.cause).toEqual(expect.any(String));

    if (options.error) {
      expect(result.error).toBe(options.error);
    }

    for (const fragment of options.causeIncludes ?? []) {
      expect(result.cause).toContain(fragment);
    }
  };

const expectOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual(output);
};

export const featureJsonPathCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-select-scalar-from-input-path',
    title: 'selects a scalar from the input path',
    group,
    tags: ['happy_path'],
    expression: '$.count',
    input: { count: 3, ignored: true },
    expected: expectOutput({ value: 3 }),
    source: {
      file: 'src/utils/selectPath.spec.ts',
      notes: 'Promotes basic direct-path scalar selection into the conformance catalog.',
    },
  }),
  singleExpressionCase({
    id: '002-select-nested-object-from-input-path',
    title: 'selects a nested object from the input path',
    group,
    tags: ['happy_path', 'nested'],
    expression: '$.profile.contact',
    input: {
      profile: {
        contact: {
          email: 'ada@example.com',
          verified: true,
        },
      },
    },
    expected: expectOutput({
      value: {
        email: 'ada@example.com',
        verified: true,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps the catalog focused on path projection shape rather than state pipeline wiring.',
    },
  }),
  singleExpressionCase({
    id: '003-select-dashed-key-with-bracket-notation',
    title: 'selects a dashed key with bracket notation',
    group,
    tags: ['happy_path', 'path_syntax'],
    expression: "$['delivery-partner'].name",
    input: {
      'delivery-partner': {
        name: 'dhl',
        tier: 'priority',
      },
    },
    expected: expectOutput({ value: 'dhl' }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Covers bracket-notation access for non-identifier object keys.',
    },
  }),
  multiExpressionCase({
    id: '004-select-execution-context-paths',
    title: 'selects values from execution input and execution metadata context',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      executionInputCustomerId: '$$.Execution.Input.order.customerId',
      executionId: '$$.Execution.Id',
    },
    input: {
      order: {
        customerId: 'cust-9',
      },
    },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        executionInputCustomerId: 'cust-9',
        executionId: expect.any(String),
      });
    },
    source: {
      file: sourceFile,
      notes:
        'Execution.Id is asserted loosely so the same case remains stable across local and AWS harnesses.',
    },
  }),
  singleExpressionCase({
    id: '005-mix-input-and-context-inside-intrinsic',
    title: 'mixes input and context paths inside an intrinsic call',
    group,
    tags: ['happy_path', 'context', 'nested'],
    expression: `States.Format('{}:{}', $.requestId, $$.Execution.Input.suffix)`,
    input: {
      requestId: 'req-42',
      suffix: 'blue',
    },
    expected: expectOutput({ value: 'req-42:blue' }),
    source: {
      file: sourceFile,
      notes: 'Shows that the expression evaluator can compose $. and $$ sources in one intrinsic.',
    },
  }),
  customDefinitionCase({
    id: '006-missing-inputpath-produces-undefined-output',
    title: 'treats a missing InputPath selection as undefined output locally',
    group,
    tags: ['missing_path', 'boundary'],
    definition: {
      StartAt: 'SelectMissing',
      States: {
        SelectMissing: {
          Type: 'Pass',
          InputPath: '$.missing',
          End: true,
        },
      },
    },
    input: {
      present: 'value',
    },
    expected: expectOutput(undefined),
    awsExecutable: false,
    skipReason:
      'AWS missing-path output materialization should be confirmed separately before treating this local behavior as portable.',
    source: {
      file: sourceFile,
      notes:
        'Uses InputPath directly so the case stays about path selection semantics rather than Parameters reshaping.',
    },
  }),
  singleExpressionCase({
    id: '007-reject-unsupported-intrinsic-function',
    title: 'fails for an unsupported intrinsic function name',
    group,
    tags: ['negative', 'unsupported_intrinsic'],
    expression: 'States.NoSuchIntrinsic($.value)',
    input: {
      value: 'x',
    },
    expected: expectExpressionFailure({
      error: 'States.Runtime',
      causeIncludes: ['not supported'],
    }),
    awsExecutable: false,
    skipReason:
      'AWS is expected to reject unsupported intrinsic names during definition validation rather than with the same local execution error shape.',
    source: {
      file: sourceFile,
      notes: 'Captures unsupported intrinsic dispatch as an expression-evaluator failure mode.',
    },
  }),
  singleExpressionCase({
    id: '008-reject-malformed-path-expression',
    title: 'fails for a malformed path expression',
    group,
    tags: ['negative', 'malformed_input'],
    expression: '$.payload[',
    input: { payload: ['x'] },
    expected: expectExpressionFailure({
      error: 'States.Runtime',
      causeIncludes: ['Invalid intrinsic invocation'],
    }),
    awsExecutable: false,
    skipReason:
      'Malformed JSONPath parser error shape is still a local characterization while shared parser parity is being normalized.',
    source: {
      file: sourceFile,
      notes:
        'This stays separate from unsupported intrinsic coverage because it exercises parser-level invalid expression handling.',
    },
  }),
];
