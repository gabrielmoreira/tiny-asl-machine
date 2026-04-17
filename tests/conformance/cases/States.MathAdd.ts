import { expect } from 'vite-plus/test';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.MathAdd';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.MathAdd.ts';

function expectAnyFailure(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBeTruthy();
  expect(result.cause).toEqual(expect.any(String));
}

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

function expectOutput(output: unknown) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const statesMathAddCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-add-positive-integers',
    title: 'adds two positive integers',
    group,
    tags: ['happy_path'],
    expression: 'States.MathAdd(5, 3)',
    input: {},
    expected: expectOutput({ value: 8 }),
    source: { file: sourceFile, caseId: 'MADD-001' },
  }),
  singleExpressionCase({
    id: '002-decrement-input-by-one',
    title: 'decrements an input value by one',
    group,
    tags: ['happy_path'],
    expression: 'States.MathAdd($.val, -1)',
    input: { val: 111 },
    expected: expectOutput({ value: 110 }),
    source: {
      file: sourceFile,
      caseId: 'MADD-002',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '003-add-negative-integers',
    title: 'adds two negative integers',
    group,
    tags: ['happy_path'],
    expression: 'States.MathAdd(-5, -3)',
    input: {},
    expected: expectOutput({ value: -8 }),
    source: { file: sourceFile, caseId: 'MADD-003' },
  }),
  singleExpressionCase({
    id: '004-add-mixed-sign-integers',
    title: 'adds mixed-sign integers',
    group,
    tags: ['happy_path'],
    expression: 'States.MathAdd(-5, 3)',
    input: {},
    expected: expectOutput({ value: -2 }),
    source: { file: sourceFile, caseId: 'MADD-004' },
  }),
  singleExpressionCase({
    id: '005-round-decimals-before-addition',
    title: 'rounds both decimal operands before addition',
    group,
    tags: ['happy_path', 'rounding'],
    expression: 'States.MathAdd($.a, $.b)',
    input: { a: 1.6, b: 2.7 },
    expected: expectOutput({ value: 5 }),
    notes: 'Characterizes AWS nearest-integer rounding before addition on non-tie decimals.',
    source: { file: sourceFile, caseId: 'MADD-005' },
  }),
  singleExpressionCase({
    id: '006-round-tiny-decimals-to-zero',
    title: 'rounds tiny decimals to zero before addition',
    group,
    tags: ['happy_path', 'rounding', 'boundary'],
    expression: 'States.MathAdd($.a, $.b)',
    input: { a: 0.1, b: 0.2 },
    expected: expectOutput({ value: 0 }),
    source: { file: sourceFile, caseId: 'MADD-006' },
  }),
  singleExpressionCase({
    id: '007-positive-half-step-rounding',
    title: 'documents positive half-step rounding behavior',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.MathAdd(1.4, 2.5)',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(Number) });
      expect([3, 4]).toContain((result.output as { value: number }).value);
    },
    awsExecutable: false,
    skipReason:
      'Half-tie rounding for States.MathAdd is valuable to catalog but should be asserted only after capturing an authoritative AWS observation.',
    source: { file: sourceFile, caseId: 'MADD-007' },
  }),
  singleExpressionCase({
    id: '008-negative-half-step-rounding',
    title: 'documents negative half-step rounding behavior',
    group,
    tags: ['rounding', 'boundary'],
    expression: 'States.MathAdd(-1.5, 0)',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(Number) });
      expect([-2, -1]).toContain((result.output as { value: number }).value);
    },
    awsExecutable: false,
    skipReason:
      'Negative half-tie rounding is intentionally retained as a non-portable observation case until AWS behavior is captured directly.',
    source: { file: sourceFile, caseId: 'MADD-008' },
  }),
  singleExpressionCase({
    id: '009-accept-max-int32-endpoint',
    title: 'accepts the maximum int32 endpoint',
    group,
    tags: ['happy_path', 'boundary', 'range_limit'],
    expression: 'States.MathAdd(2147483647, 0)',
    input: {},
    expected: expectOutput({ value: 2147483647 }),
    source: { file: sourceFile, caseId: 'MADD-009' },
  }),
  singleExpressionCase({
    id: '010-accept-min-int32-endpoint',
    title: 'accepts the minimum int32 endpoint',
    group,
    tags: ['happy_path', 'boundary', 'range_limit'],
    expression: 'States.MathAdd(-2147483648, 0)',
    input: {},
    expected: expectOutput({ value: -2147483648 }),
    source: { file: sourceFile, caseId: 'MADD-010' },
  }),
  singleExpressionCase({
    id: '011-fail-sum-overflow-int32',
    title: 'fails when the sum overflows int32',
    group,
    tags: ['negative', 'range_limit', 'boundary'],
    expression: 'States.MathAdd(2147483647, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-011' },
  }),
  singleExpressionCase({
    id: '012-fail-sum-underflow-int32',
    title: 'fails when the sum underflows int32',
    group,
    tags: ['negative', 'range_limit', 'boundary'],
    expression: 'States.MathAdd(-2147483648, -1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-012' },
  }),
  singleExpressionCase({
    id: '013-fail-first-operand-out-of-range',
    title: 'fails when the first operand exceeds int32 range',
    group,
    tags: ['negative', 'range_limit', 'type_validation'],
    expression: 'States.MathAdd(3000000000, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-013' },
  }),
  singleExpressionCase({
    id: '014-fail-negative-operand-out-of-range',
    title: 'fails when a negative operand is below int32 range',
    group,
    tags: ['negative', 'range_limit', 'type_validation'],
    expression: 'States.MathAdd(-3000000000, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-014' },
  }),
  singleExpressionCase({
    id: '015-accept-upper-bound-sum',
    title: 'accepts a just-inside upper-bound sum',
    group,
    tags: ['happy_path', 'boundary', 'range_limit'],
    expression: 'States.MathAdd(2147483646, 1)',
    input: {},
    expected: expectOutput({ value: 2147483647 }),
    source: { file: sourceFile, caseId: 'MADD-015' },
  }),
  singleExpressionCase({
    id: '016-accept-lower-bound-sum',
    title: 'accepts a just-inside lower-bound sum',
    group,
    tags: ['happy_path', 'boundary', 'range_limit'],
    expression: 'States.MathAdd(-2147483647, -1)',
    input: {},
    expected: expectOutput({ value: -2147483648 }),
    source: { file: sourceFile, caseId: 'MADD-016' },
  }),
  singleExpressionCase({
    id: '017-reject-string-first-operand',
    title: 'rejects a string first operand',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathAdd('a', 1)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-017' },
  }),
  singleExpressionCase({
    id: '018-reject-string-second-operand',
    title: 'rejects a string second operand',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathAdd(1, 'b')",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-018' },
  }),
  singleExpressionCase({
    id: '019-reject-null-first-operand',
    title: 'rejects a null first operand',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.MathAdd(null, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-019' },
  }),
  singleExpressionCase({
    id: '020-reject-boolean-first-operand',
    title: 'rejects a boolean first operand',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.MathAdd(true, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-020' },
  }),
  singleExpressionCase({
    id: '021-reject-missing-second-argument',
    title: 'rejects a missing second argument',
    group,
    tags: ['negative', 'arity'],
    expression: 'States.MathAdd(1)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'MADD-021' },
  }),
  singleExpressionCase({
    id: '022-reject-extra-third-argument',
    title: 'rejects an extra third argument',
    group,
    tags: ['negative', 'arity'],
    expression: 'States.MathAdd(1, 2, 999)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'MADD-022' },
  }),
  singleExpressionCase({
    id: '023-nested-mathadd-composition',
    title: 'supports nested MathAdd composition',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.MathAdd(States.MathAdd($.x, 1), 2)',
    input: { x: 5 },
    expected: expectOutput({ value: 8 }),
    source: { file: sourceFile, caseId: 'MADD-023' },
  }),
  singleExpressionCase({
    id: '024-mathadd-into-array',
    title: 'feeds MathAdd results into States.Array',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.Array(States.MathAdd($.x, -1), States.MathAdd($.x, 1))',
    input: { x: 5 },
    expected: expectOutput({ value: [4, 6] }),
    source: { file: sourceFile, caseId: 'MADD-024' },
  }),
  multiExpressionCase({
    id: '025-mix-context-and-state-input',
    title: 'mixes execution input context and state input',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: 'States.MathAdd($$.Execution.Input.offset, $.delta)',
      offsetFromContext: '$$.Execution.Input.offset',
    },
    input: { offset: 10, delta: 5 },
    expected: expectOutput({
      value: 15,
      offsetFromContext: 10,
    }),
    notes: 'Uses the same execution payload through both $$.Execution.Input and $. paths.',
    source: { file: sourceFile, caseId: 'MADD-025' },
  }),
  singleExpressionCase({
    id: '026-reject-positive-non-finite-literal',
    title: 'rejects a positive non-finite numeric literal',
    group,
    tags: ['negative', 'malformed_input'],
    expression: 'States.MathAdd(1e309, 1)',
    input: {},
    expected: result => expectAnyFailure(result),
    notes:
      'Preserves local parser coverage for scientific-notation literals even though AWS currently accepts this form and returns a numeric result.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this scientific-notation literal for States.MathAdd instead of rejecting it, so keep the stricter local behavior as a local-only characterization for now.',
    source: { file: sourceFile, caseId: 'MADD-026' },
  }),
  singleExpressionCase({
    id: '027-reject-negative-non-finite-literal',
    title: 'rejects a negative non-finite numeric literal',
    group,
    tags: ['negative', 'malformed_input'],
    expression: 'States.MathAdd(-1e309, 1)',
    input: {},
    expected: result => expectAnyFailure(result),
    notes:
      'Preserves local parser coverage for negative scientific-notation literals even though AWS currently accepts this form and returns a numeric result.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this negative scientific-notation literal for States.MathAdd instead of rejecting it, so keep the stricter local behavior as a local-only characterization for now.',
    source: { file: sourceFile, caseId: 'MADD-027' },
  }),
  singleExpressionCase({
    id: '028-reject-boolean-plus-negative-number',
    title: 'rejects a boolean operand even when paired with a negative number',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: 'States.MathAdd(false, -1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-028' },
  }),
  singleExpressionCase({
    id: '029-reject-boolean-plus-string-numeral',
    title: 'rejects boolean plus string even when the string looks numeric',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathAdd(false, '2')",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-029' },
  }),
  singleExpressionCase({
    id: '030-reject-string-numeral-plus-boolean',
    title: 'rejects a numeric-looking string when paired with a boolean',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathAdd('2', true)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-030' },
  }),
  singleExpressionCase({
    id: '031-reject-negative-string-plus-number',
    title: 'rejects a negative numeric-looking string instead of coercing it',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: "States.MathAdd('-1', 2)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-031' },
  }),
  singleExpressionCase({
    id: '032-reject-fractional-string-plus-number',
    title: 'rejects a fractional numeric-looking string instead of rounding it',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: "States.MathAdd('1.5', 2)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-032' },
  }),
  singleExpressionCase({
    id: '033-reject-huge-positive-string-plus-number',
    title: 'rejects a huge positive numeric-looking string before any range coercion',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: "States.MathAdd('3000000000', 1)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-033' },
  }),
  singleExpressionCase({
    id: '034-reject-huge-negative-string-plus-number',
    title: 'rejects a huge negative numeric-looking string before any range coercion',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: "States.MathAdd('-3000000000', 1)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-034' },
  }),
  singleExpressionCase({
    id: '035-reject-string-plus-mixed-array-probe',
    title: 'rejects a string operand when the other operand is a mixed-value array probe',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: 'States.MathAdd($.text, $.probe)',
    input: {
      text: '1',
      probe: [null, '', ' ', 0, 1, true, false, [0, 1, false]],
    },
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-035' },
  }),
  singleExpressionCase({
    id: '036-reject-negative-number-plus-mixed-array-probe',
    title: 'rejects a mixed-value array probe even when paired with a negative number',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: 'States.MathAdd(-1, $.probe)',
    input: {
      probe: [null, '', ' ', 0, 1, true, false, [0, 1, false]],
    },
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MADD-036' },
  }),
];
