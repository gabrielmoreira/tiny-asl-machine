import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayPartition';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayPartition.ts';

function expectIntrinsicFailure(causeIncludes?: string[]) {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toEqual(expect.any(String));

    for (const snippet of causeIncludes ?? []) {
      expect(result.cause).toContain(snippet);
    }
  };
}

const expectOutput = (value: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual({ value });
};

export const statesArrayPartitionCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-singleton-partitions',
    title: 'chunk size 1 creates singleton partitions',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayPartition($.arr, 1)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput([[1], [2], [3]]),
    source: { file: sourceFile, caseId: 'AP-001' },
  }),
  singleExpressionCase({
    id: '002-even-partitions',
    title: 'evenly partitions an exactly divisible array',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayPartition($.arr, 2)',
    input: { arr: [1, 2, 3, 4] },
    expected: expectOutput([
      [1, 2],
      [3, 4],
    ]),
    source: { file: sourceFile, caseId: 'AP-002' },
  }),
  singleExpressionCase({
    id: '003-remainder-chunk',
    title: 'keeps a shorter final remainder chunk',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayPartition($.arr, 4)',
    input: { arr: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    expected: expectOutput([[1, 2, 3, 4], [5, 6, 7, 8], [9]]),
    source: { file: sourceFile, caseId: 'AP-003' },
  }),
  singleExpressionCase({
    id: '004-oversized-chunk',
    title: 'oversized chunk returns the full array as one chunk',
    group,
    tags: ['boundary'],
    expression: 'States.ArrayPartition($.arr, 10)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput([[1, 2, 3]]),
    source: { file: sourceFile, caseId: 'AP-004' },
  }),
  singleExpressionCase({
    id: '005-empty-array',
    title: 'empty array stays empty',
    group,
    tags: ['boundary'],
    expression: 'States.ArrayPartition($.arr, 3)',
    input: { arr: [] },
    expected: expectOutput([]),
    source: { file: sourceFile, caseId: 'AP-005' },
  }),
  singleExpressionCase({
    id: '006-nested-arrays',
    title: 'partitions arrays containing nested arrays without flattening them',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayPartition($.arr, 2)',
    input: { arr: [[1], [2], [3], [4]] },
    expected: expectOutput([
      [[1], [2]],
      [[3], [4]],
    ]),
    source: { file: sourceFile, caseId: 'AP-006' },
  }),
  singleExpressionCase({
    id: '007-object-elements',
    title: 'partitions arrays containing objects without altering element identity',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayPartition($.arr, 2)',
    input: { arr: [{ a: 1 }, { b: 2 }, { c: 3 }] },
    expected: expectOutput([[{ a: 1 }, { b: 2 }], [{ c: 3 }]]),
    source: { file: sourceFile, caseId: 'AP-007' },
  }),
  singleExpressionCase({
    id: '008-round-up-chunk-size',
    title: 'rounds 2.6 up to chunk size 3 before partitioning',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.ArrayPartition($.arr, 2.6)',
    input: { arr: [1, 2, 3, 4, 5] },
    expected: expectOutput([
      [1, 2, 3],
      [4, 5],
    ]),
    awsExecutable: false,
    skipReason:
      'AWS truncates fractional chunk sizes for States.ArrayPartition rather than rounding 2.6 up to 3, so this cataloged rounding characterization remains local-only for now.',
    notes:
      'Local runtime rounds 2.6 to 3 before partitioning; AWS currently behaves like the 2.4 case and returns [[1, 2], [3, 4], [5]].',
    source: { file: sourceFile, caseId: 'AP-013' },
  }),
  singleExpressionCase({
    id: '009-round-down-chunk-size',
    title: 'rounds 2.4 down to chunk size 2 before partitioning',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.ArrayPartition($.arr, 2.4)',
    input: { arr: [1, 2, 3, 4, 5] },
    expected: expectOutput([[1, 2], [3, 4], [5]]),
    source: { file: sourceFile, caseId: 'AP-014' },
  }),
  singleExpressionCase({
    id: '010-round-up-to-one',
    title: 'rounds 0.6 up to the minimum valid chunk size of 1',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.ArrayPartition($.arr, 0.6)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput([[1], [2], [3]]),
    awsExecutable: false,
    skipReason:
      'AWS currently rejects fractional chunk sizes below 1 for States.ArrayPartition instead of rounding 0.6 up to the minimum valid chunk size.',
    notes: 'AWS returns States.Runtime with the generic invalid-arguments envelope for this input.',
    source: { file: sourceFile, caseId: 'AP-015' },
  }),
  singleExpressionCase({
    id: '011-round-to-zero',
    title: 'rounding 0.49 down to zero fails validation',
    group,
    tags: ['rounding', 'negative', 'boundary'],
    expression: 'States.ArrayPartition($.arr, 0.49)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-016' },
  }),
  singleExpressionCase({
    id: '012-negative-round-to-zero',
    title: 'rounding -0.4 to zero still fails validation',
    group,
    tags: ['rounding', 'negative', 'boundary'],
    expression: 'States.ArrayPartition($.arr, -0.4)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    notes: 'Useful to pin down round-then-validate ordering around negative zero.',
    source: { file: sourceFile, caseId: 'AP-017' },
  }),
  singleExpressionCase({
    id: '013-round-to-negative-one',
    title: 'rounding -0.6 to -1 fails validation',
    group,
    tags: ['rounding', 'negative'],
    expression: 'States.ArrayPartition($.arr, -0.6)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-018' },
  }),
  singleExpressionCase({
    id: '014-non-array-first-arg',
    title: 'rejects a literal non-array first argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayPartition('not-array', 2)",
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-008' },
  }),
  singleExpressionCase({
    id: '015-missing-array-path',
    title: 'missing array path resolves to non-array input and fails validation',
    group,
    tags: ['malformed_input', 'negative'],
    expression: 'States.ArrayPartition($.missing, 2)',
    input: {},
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(
        ["could not be found in the input '{}'", 'Invalid arguments in States.ArrayPartition'].some(
          snippet => result.cause?.includes(snippet)
        )
      ).toBe(true);
    },
    source: { file: sourceFile, caseId: 'AP-026' },
  }),
  singleExpressionCase({
    id: '016-string-chunk-size',
    title: 'rejects a string chunk size',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayPartition($.arr, '2')",
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-009' },
  }),
  singleExpressionCase({
    id: '017-null-chunk-size',
    title: 'rejects a null chunk size',
    group,
    tags: ['type_validation', 'negative'],
    expression: 'States.ArrayPartition($.arr, null)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-010' },
  }),
  singleExpressionCase({
    id: '018-zero-chunk-size',
    title: 'rejects literal zero chunk size',
    group,
    tags: ['range_limit', 'negative'],
    expression: 'States.ArrayPartition($.arr, 0)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-011' },
  }),
  singleExpressionCase({
    id: '019-negative-chunk-size',
    title: 'rejects negative integer chunk size',
    group,
    tags: ['range_limit', 'negative'],
    expression: 'States.ArrayPartition($.arr, -1)',
    input: { arr: [1, 2, 3] },
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayPartition']),
    source: { file: sourceFile, caseId: 'AP-012' },
  }),
  singleExpressionCase({
    id: '020-missing-chunk-size',
    title: 'missing chunk-size argument fails exact arity validation',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayPartition($.arr)',
    input: { arr: [1, 2, 3] },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.cause).toEqual(expect.any(String));
    },
    notes: 'Retained from the observation catalog to ensure under-arity remains covered.',
    source: { file: sourceFile, caseId: 'AP-019' },
  }),
  singleExpressionCase({
    id: '021-extra-trailing-arg',
    title: 'extra trailing argument fails exact arity validation',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayPartition($.arr, 2, 999)',
    input: { arr: [1, 2, 3] },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.cause).toEqual(expect.any(String));
    },
    notes:
      'AWS treats intrinsic functions as fixed-arity; this case preserves that contract defensively.',
    source: { file: sourceFile, caseId: 'AP-020' },
  }),
  singleExpressionCase({
    id: '022-nested-intrinsic-array',
    title: 'partitions an array produced by a nested intrinsic',
    group,
    tags: ['nested', 'happy_path'],
    expression: 'States.ArrayPartition(States.Array(1,2,3,4,5), 2)',
    input: {},
    expected: expectOutput([[1, 2], [3, 4], [5]]),
    source: { file: sourceFile, caseId: 'AP-021' },
  }),
  singleExpressionCase({
    id: '023-context-chunk-size',
    title: 'reads chunk size from execution input context',
    group,
    tags: ['context', 'happy_path'],
    expression: 'States.ArrayPartition($.arr, $$.Execution.Input.chunkSize)',
    input: { arr: [1, 2, 3, 4, 5], chunkSize: 2 },
    expected: expectOutput([[1, 2], [3, 4], [5]]),
    notes: 'Mirrors the execution-input context scenario from the observation catalog.',
    source: { file: sourceFile, caseId: 'AP-022' },
  }),
  singleExpressionCase({
    id: '024-very-large-chunk',
    title: 'very large positive chunk size still returns one chunk',
    group,
    tags: ['boundary'],
    expression: 'States.ArrayPartition($.arr, 2147483647)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput([[1, 2, 3]]),
    source: { file: sourceFile, caseId: 'AP-024' },
  }),
  singleExpressionCase({
    id: '025-trailing-comma',
    title: 'trailing comma with missing second argument is malformed intrinsic syntax',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.ArrayPartition($.arr, )',
    input: { arr: [1, 2] },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.cause).toEqual(expect.any(String));
    },
    awsExecutable: false,
    skipReason:
      'Malformed intrinsic syntax is valuable catalog coverage but is not a portable executable AWS runtime scenario.',
    source: { file: sourceFile, caseId: 'AP-025' },
  }),
];
