import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.Array';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.Array.ts';

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

export const statesArrayCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-empty-array',
    title: 'Construct empty array with zero arguments',
    group,
    tags: ['happy_path'],
    expression: 'States.Array()',
    input: {},
    expected: expectOutput([]),
    source: { file: sourceFile, caseId: 'ARR-001' },
  }),
  singleExpressionCase({
    id: '002-ordered-paths',
    title: 'Construct array from multiple ordered paths',
    group,
    tags: ['happy_path'],
    expression: 'States.Array($.a, $.b, $.c)',
    input: { a: 1, b: '2', c: true },
    expected: expectOutput([1, '2', true]),
    source: {
      file: sourceFile,
      caseId: 'ARR-003',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '003-mixed-scalars',
    title: 'Construct array from mixed scalar literals',
    group,
    tags: ['happy_path'],
    expression: "States.Array(42, true, null, 'hello')",
    input: {},
    expected: expectOutput([42, true, null, 'hello']),
    source: { file: sourceFile, caseId: 'ARR-004' },
  }),
  singleExpressionCase({
    id: '004-object-array-values',
    title: 'Preserve object and array values from paths',
    group,
    tags: ['happy_path'],
    expression: 'States.Array($.obj, $.arr)',
    input: { obj: { k: 1 }, arr: [1, 2] },
    expected: expectOutput([{ k: 1 }, [1, 2]]),
    source: { file: sourceFile, caseId: 'ARR-005' },
  }),
  singleExpressionCase({
    id: '005-nested-call',
    title: 'Compose nested States.Array calls',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.Array(1, States.Array(2, 3))',
    input: {},
    expected: expectOutput([1, [2, 3]]),
    source: {
      file: sourceFile,
      caseId: 'ARR-006',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '006-context-paths',
    title: 'Mix execution-input context and input paths',
    group,
    tags: ['happy_path', 'context'],
    expression: 'States.Array($$.Execution.Input.userId, $.role, $.enabled)',
    input: { userId: 7, role: 'admin', enabled: false },
    expected: expectOutput([7, 'admin', false]),
    notes:
      'Uses execution input context instead of a live execution id so the case remains deterministic.',
    source: {
      file: sourceFile,
      caseId: 'ARR-007',
      notes: 'Adapted from the legacy context-interoperability probe.',
    },
  }),
  singleExpressionCase({
    id: '007-falsy-scalars',
    title: 'Preserve falsy scalar literals',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Array(false, '', 0, null)",
    input: {},
    expected: expectOutput([false, '', 0, null]),
    source: { file: sourceFile, caseId: 'ARR-008' },
  }),
  singleExpressionCase({
    id: '008-repeat-path-value',
    title: 'Repeat the same path value multiple times',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Array($.a, $.a, $.a)',
    input: { a: { x: 1 } },
    expected: expectOutput([{ x: 1 }, { x: 1 }, { x: 1 }]),
    source: { file: sourceFile, caseId: 'ARR-009' },
  }),
  singleExpressionCase({
    id: '009-exceed-nesting-limit',
    title: 'Reject intrinsic nesting deeper than the documented AWS limit',
    group,
    tags: ['boundary', 'aws_limit', 'negative', 'local_only'],
    expression:
      'States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(States.Array(1)))))))))))',
    input: {},
    expected: expectOutput([[[[[[[[[[[1]]]]]]]]]]]),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting limit for this family; keep this as a documented local-only behavior until parser parity work is completed.',
    notes: 'Intentionally exceeds the documented Step Functions intrinsic nesting limit.',
    source: { file: sourceFile, caseId: 'ARR-017' },
  }),
  singleExpressionCase({
    id: '010-argument-whitespace',
    title: 'Tolerate internal argument whitespace',
    group,
    tags: ['happy_path', 'parser'],
    expression: 'States.Array( $.a , $.b )',
    input: { a: 1, b: 2 },
    expected: expectOutput([1, 2]),
    source: {
      file: sourceFile,
      caseId: 'ARR-018',
      notes: 'Also covered by src/utils/parseIntrinsicFunction.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '011-trailing-tokens',
    title: 'Reject trailing tokens after a valid call',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.Array($.a) trailing',
    input: { a: 1 },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting and malformed-call contract for this family; keep as local characterization until shared parser parity is completed.',
    source: { file: sourceFile, caseId: 'ARR-011' },
  }),
  singleExpressionCase({
    id: '012-unfinished-parenthesis',
    title: 'Reject unfinished opening parenthesis',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.Array(',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting and malformed-call contract for this family; keep as local characterization until shared parser parity is completed.',
    source: { file: sourceFile, caseId: 'ARR-012' },
  }),
  singleExpressionCase({
    id: '013-array-literal-syntax',
    title: 'Reject direct array literal argument syntax',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.Array([1,2])',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting and malformed-call contract for this family; keep as local characterization until shared parser parity is completed.',
    notes: 'Direct JSON array literals are kept as a grammar-conformance case.',
    source: { file: sourceFile, caseId: 'ARR-013' },
  }),
  singleExpressionCase({
    id: '014-trailing-decimal-point',
    title: 'Reject a numeric literal with a trailing decimal point',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.Array(1.)',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting and malformed-call contract for this family; keep as local characterization until shared parser parity is completed.',
    notes: 'Ported from parser strictness coverage in src/utils/selectPath.spec.ts.',
    source: {
      file: 'src/utils/selectPath.spec.ts',
      notes: 'Invalid JSON-number grammar should fail before execution succeeds.',
    },
  }),
  singleExpressionCase({
    id: '015-leading-decimal-point',
    title: 'Reject a numeric literal with a leading decimal point',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.Array(.5)',
    input: {},
    expected: expectFailure(),
    awsExecutable: false,
    skipReason:
      'Current local intrinsic parser/runtime does not yet enforce the AWS nesting and malformed-call contract for this family; keep as local characterization until shared parser parity is completed.',
    notes: 'Ported from parser strictness coverage in src/utils/selectPath.spec.ts.',
    source: {
      file: 'src/utils/selectPath.spec.ts',
      notes: 'Invalid JSON-number grammar should fail before execution succeeds.',
    },
  }),
  singleExpressionCase({
    id: '016-mixed-contained-values',
    title: 'Preserve mixed contained values from input paths',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Array($.nil, $.empty, $.space, $.zero, $.one, $.yes, $.no, $.nested)',
    input: {
      nil: null,
      empty: '',
      space: ' ',
      zero: 0,
      one: 1,
      yes: true,
      no: false,
      nested: [0, 1, false],
    },
    expected: expectOutput([null, '', ' ', 0, 1, true, false, [0, 1, false]]),
    source: { file: sourceFile, caseId: 'ARR-019' },
  }),
  singleExpressionCase({
    id: '017-mixed-numeric-boundaries',
    title: 'Mix numeric boundary values with strings and arrays',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Array($.label, $.neg, $.frac, $.hugeNeg, $.hugePos, $.nested)',
    input: {
      label: 'numbers',
      neg: -1,
      frac: 1.5,
      hugeNeg: -9007199254740991,
      hugePos: 9007199254740991,
      nested: [0, 1, false],
    },
    expected: expectOutput([
      'numbers',
      -1,
      1.5,
      -9007199254740991,
      9007199254740991,
      [0, 1, false],
    ]),
    source: { file: sourceFile, caseId: 'ARR-020' },
  }),
];
