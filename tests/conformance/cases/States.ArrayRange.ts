import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayRange';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayRange.ts';

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

function expectOutput(value: number[]) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ value });
  };
}

export const statesArrayRangeCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-odd-number-range',
    title: 'builds the documented odd-number range',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayRange(1, 9, 2)',
    input: {},
    expected: expectOutput([1, 3, 5, 7, 9]),
    source: { file: sourceFile, caseId: 'ARANGE-001' },
  }),
  singleExpressionCase({
    id: '002-unit-step-range',
    title: 'includes every integer with unit step',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayRange(1, 5, 1)',
    input: {},
    expected: expectOutput([1, 2, 3, 4, 5]),
    source: { file: sourceFile, caseId: 'ARANGE-002' },
  }),
  singleExpressionCase({
    id: '003-crosses-zero',
    title: 'crosses zero in a mixed-sign positive-step range',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayRange(-2, 2, 2)',
    input: {},
    expected: expectOutput([-2, 0, 2]),
    source: { file: sourceFile, caseId: 'ARANGE-003' },
  }),
  singleExpressionCase({
    id: '004-round-all-arguments',
    title: 'rounds all three numeric arguments before range generation',
    group,
    tags: ['rounding', 'happy_path'],
    expression: 'States.ArrayRange(1.4, 5.6, 2.2)',
    input: {},
    expected: expectOutput([1, 3, 5]),
    notes: 'Equivalent to States.ArrayRange(1, 6, 2) after rounding.',
    source: { file: sourceFile, caseId: 'ARANGE-004' },
  }),
  singleExpressionCase({
    id: '005-equal-bounds-positive-step',
    title: 'equal bounds with positive step produce a singleton result',
    group,
    tags: ['boundary', 'happy_path'],
    expression: 'States.ArrayRange(3, 3, 1)',
    input: {},
    expected: expectOutput([3]),
    source: { file: sourceFile, caseId: 'ARANGE-005' },
  }),
  singleExpressionCase({
    id: '006-equal-bounds-negative-step',
    title: 'equal bounds with negative step also produce a singleton result',
    group,
    tags: ['boundary', 'happy_path'],
    expression: 'States.ArrayRange(3, 3, -1)',
    input: {},
    expected: expectOutput([3]),
    source: { file: sourceFile, caseId: 'ARANGE-006' },
  }),
  singleExpressionCase({
    id: '007-descending-range',
    title: 'descending range with negative step',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayRange(5, 1, -2)',
    input: {},
    expected: expectOutput([5, 3, 1]),
    source: { file: sourceFile, caseId: 'ARANGE-007' },
  }),
  singleExpressionCase({
    id: '008-descending-positive-step-empty',
    title: 'descending bounds with positive step yield an empty range',
    group,
    tags: ['boundary', 'negative_direction'],
    expression: 'States.ArrayRange(5, 1, 1)',
    input: {},
    expected: expectOutput([]),
    source: { file: sourceFile, caseId: 'ARANGE-008' },
  }),
  singleExpressionCase({
    id: '009-ascending-negative-step-empty',
    title: 'ascending bounds with negative step yield an empty range',
    group,
    tags: ['boundary', 'negative_direction'],
    expression: 'States.ArrayRange(1, 5, -1)',
    input: {},
    expected: expectOutput([]),
    source: { file: sourceFile, caseId: 'ARANGE-009' },
  }),
  singleExpressionCase({
    id: '010-rounded-reverse-direction',
    title: 'rounding can reverse direction and still produce an empty range',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.ArrayRange(1.6, 1.4, 1)',
    input: {},
    expected: expectOutput([]),
    awsExecutable: false,
    skipReason:
      'AWS truncates fractional ArrayRange bounds before evaluation here, producing a singleton [1] instead of the empty range from round-to-nearest semantics.',
    notes:
      'Local runtime rounds to States.ArrayRange(2, 1, 1); AWS currently behaves like States.ArrayRange(1, 1, 1).',
    source: { file: sourceFile, caseId: 'ARANGE-023' },
  }),
  singleExpressionCase({
    id: '011-rounded-descending-fractional',
    title: 'descending fractional inputs combine rounding with negative-step semantics',
    group,
    tags: ['rounding', 'happy_path'],
    expression: 'States.ArrayRange(5.4, -0.6, -2.4)',
    input: {},
    expected: expectOutput([5, 3, 1, -1]),
    awsExecutable: false,
    skipReason:
      'AWS truncates fractional ArrayRange inputs here, stopping at [5, 3, 1] instead of the local round-to-nearest result that includes -1.',
    notes:
      'Local runtime rounds to States.ArrayRange(5, -1, -2); AWS currently behaves like States.ArrayRange(5, 0, -2).',
    source: { file: sourceFile, caseId: 'ARANGE-024' },
  }),
  singleExpressionCase({
    id: '012-non-numeric-start',
    title: 'rejects a non-numeric start argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayRange('a', 5, 1)",
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-010' },
  }),
  singleExpressionCase({
    id: '013-non-numeric-end',
    title: 'rejects a non-numeric end argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayRange(1, 'b', 1)",
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-011' },
  }),
  singleExpressionCase({
    id: '014-non-numeric-step',
    title: 'rejects a non-numeric step argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayRange(1, 5, 'c')",
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-012' },
  }),
  singleExpressionCase({
    id: '015-zero-step',
    title: 'rejects literal zero step',
    group,
    tags: ['range_limit', 'negative'],
    expression: 'States.ArrayRange(1, 10, 0)',
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-013' },
  }),
  singleExpressionCase({
    id: '016-rounded-zero-step',
    title: 'rejects a step that rounds to zero',
    group,
    tags: ['rounding', 'range_limit', 'negative', 'boundary'],
    expression: 'States.ArrayRange(1, 10, 0.49)',
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    notes: 'Confirms that rounding occurs before zero-step validation.',
    source: { file: sourceFile, caseId: 'ARANGE-014' },
  }),
  singleExpressionCase({
    id: '017-forward-limit-1000',
    title: 'exactly 1000 items succeeds at the forward limit',
    group,
    tags: ['aws_limit', 'boundary', 'happy_path'],
    expression: 'States.ArrayRange(1, 1000, 1)',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        value: expect.any(Array),
      });
      const output = result.output as { value: number[] };
      expect(output.value).toHaveLength(1000);
      expect(output.value[0]).toBe(1);
      expect(output.value[999]).toBe(1000);
    },
    source: { file: sourceFile, caseId: 'ARANGE-015' },
  }),
  singleExpressionCase({
    id: '018-forward-limit-exceeded',
    title: '1001 forward items exceed the documented cap',
    group,
    tags: ['aws_limit', 'negative'],
    expression: 'States.ArrayRange(1, 1001, 1)',
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-016' },
  }),
  singleExpressionCase({
    id: '019-descending-limit-1000',
    title: 'exactly 1000 descending items succeed at the symmetric limit',
    group,
    tags: ['aws_limit', 'boundary', 'happy_path'],
    expression: 'States.ArrayRange(1000, 1, -1)',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        value: expect.any(Array),
      });
      const output = result.output as { value: number[] };
      expect(output.value).toHaveLength(1000);
      expect(output.value[0]).toBe(1000);
      expect(output.value[999]).toBe(1);
    },
    source: { file: sourceFile, caseId: 'ARANGE-017' },
  }),
  singleExpressionCase({
    id: '020-descending-limit-exceeded',
    title: '1001 descending items exceed the documented cap',
    group,
    tags: ['aws_limit', 'negative'],
    expression: 'States.ArrayRange(1001, 1, -1)',
    input: {},
    expected: expectIntrinsicFailure(['Invalid arguments in States.ArrayRange']),
    source: { file: sourceFile, caseId: 'ARANGE-018' },
  }),
  singleExpressionCase({
    id: '021-missing-third-arg',
    title: 'missing third argument fails exact arity validation',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayRange(1, 5)',
    input: {},
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.cause).toEqual(expect.any(String));
    },
    source: { file: sourceFile, caseId: 'ARANGE-019' },
  }),
  singleExpressionCase({
    id: '022-extra-fourth-arg',
    title: 'extra fourth argument fails exact arity validation',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayRange(1, 5, 1, 99)',
    input: {},
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBeTruthy();
      expect(result.cause).toEqual(expect.any(String));
    },
    notes: 'Observation catalog flagged this as a likely AWS/local mismatch hotspot.',
    source: { file: sourceFile, caseId: 'ARANGE-020' },
  }),
  singleExpressionCase({
    id: '023-nested-mathadd',
    title: 'consumes nested MathAdd results as arguments',
    group,
    tags: ['nested', 'happy_path'],
    expression: 'States.ArrayRange(States.MathAdd($.base, 1), States.MathAdd($.base, 5), 2)',
    input: { base: 0 },
    expected: expectOutput([1, 3, 5]),
    source: { file: sourceFile, caseId: 'ARANGE-021' },
  }),
  singleExpressionCase({
    id: '024-context-arguments',
    title: 'reads all arguments from execution input context',
    group,
    tags: ['context', 'happy_path'],
    expression:
      'States.ArrayRange($$.Execution.Input.start, $$.Execution.Input.end, $$.Execution.Input.step)',
    input: { start: 2, end: 6, step: 2 },
    expected: expectOutput([2, 4, 6]),
    source: { file: sourceFile, caseId: 'ARANGE-022' },
  }),
];
