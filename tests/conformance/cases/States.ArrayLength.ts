import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayLength';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayLength.ts';

const expectFailure =
  (options: { error?: string } = {}) =>
  (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(result.cause).toEqual(expect.any(String));

    if (options.error) {
      expect(result.error).toBe(options.error);
    }
  };

const expectOutput = (value: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual({ value });
};

export const statesArrayLengthCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-empty-array',
    title: 'Return zero for empty array',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayLength($.arr)',
    input: { arr: [] },
    expected: expectOutput(0),
    source: {
      file: sourceFile,
      caseId: 'AL-001',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '002-populated-numeric-array',
    title: 'Return count for populated numeric array',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayLength($.arr)',
    input: { arr: [1, 2, 3, 4, 5] },
    expected: expectOutput(5),
    source: {
      file: sourceFile,
      caseId: 'AL-003',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '003-top-level-nested-arrays',
    title: 'Count top-level nested arrays only',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayLength($.arr)',
    input: { arr: [[1], [2], [3]] },
    expected: expectOutput(3),
    source: { file: sourceFile, caseId: 'AL-004' },
  }),
  singleExpressionCase({
    id: '004-top-level-objects',
    title: 'Count top-level object elements only',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayLength($.arr)',
    input: { arr: [{ a: 1 }, { b: 2 }] },
    expected: expectOutput(2),
    source: { file: sourceFile, caseId: 'AL-005' },
  }),
  singleExpressionCase({
    id: '005-nested-empty-array',
    title: 'Count empty array produced by nested intrinsic',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayLength(States.Array())',
    input: {},
    expected: expectOutput(0),
    source: { file: sourceFile, caseId: 'AL-006' },
  }),
  singleExpressionCase({
    id: '006-nested-populated-array',
    title: 'Count populated array produced by nested intrinsic',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayLength(States.Array(1, 2, 3))',
    input: {},
    expected: expectOutput(3),
    source: { file: sourceFile, caseId: 'AL-007' },
  }),
  singleExpressionCase({
    id: '007-context-path-array',
    title: 'Count array from execution-input context path',
    group,
    tags: ['happy_path', 'context'],
    expression: 'States.ArrayLength($$.Execution.Input.items)',
    input: { items: [1, 2, 3] },
    expected: expectOutput(3),
    source: { file: sourceFile, caseId: 'AL-008' },
  }),
  singleExpressionCase({
    id: '008-one-thousand-items',
    title: 'Count large array with one thousand items',
    group,
    tags: ['boundary', 'aws_limit'],
    expression: 'States.ArrayLength($.arr)',
    input: { arr: Array.from({ length: 1000 }, (_, index) => index) },
    expected: expectOutput(1000),
    source: { file: sourceFile, caseId: 'AL-017' },
  }),
  singleExpressionCase({
    id: '009-string-argument',
    title: 'Reject string argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayLength('not-array')",
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    source: {
      file: sourceFile,
      caseId: 'AL-009',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '010-object-path-argument',
    title: 'Reject object argument from input path',
    group,
    tags: ['type_validation', 'negative'],
    expression: 'States.ArrayLength($.obj)',
    input: { obj: { k: 1 } },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AL-012' },
  }),
  singleExpressionCase({
    id: '011-zero-argument',
    title: 'Reject zero-argument arity',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayLength()',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AL-013' },
  }),
  singleExpressionCase({
    id: '012-extra-argument',
    title: 'Reject extra-argument arity',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayLength($.arr, 999)',
    input: { arr: [1, 2, 3] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AL-014' },
  }),
  singleExpressionCase({
    id: '013-missing-parenthesis',
    title: 'Reject malformed missing parenthesis',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.ArrayLength($.arr',
    input: { arr: [1] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AL-015' },
  }),
];
