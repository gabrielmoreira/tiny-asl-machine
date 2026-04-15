import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayGetItem';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayGetItem.ts';

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

export const statesArrayGetItemCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-first-string-item',
    title: 'Return first item from string array',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayGetItem($.arr, 0)',
    input: { arr: ['a', 'b', 'c'] },
    expected: expectOutput('a'),
    source: {
      file: sourceFile,
      caseId: 'AGI-001',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '002-middle-string-item',
    title: 'Return middle item from string array',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayGetItem($.arr, 1)',
    input: { arr: ['a', 'b', 'c'] },
    expected: expectOutput('b'),
    source: { file: sourceFile, caseId: 'AGI-002' },
  }),
  singleExpressionCase({
    id: '003-path-derived-index',
    title: 'Use path-derived numeric index',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayGetItem($.arr, $.idx)',
    input: { arr: [10, 20, 30, 40], idx: 2 },
    expected: expectOutput(30),
    source: { file: sourceFile, caseId: 'AGI-004' },
  }),
  singleExpressionCase({
    id: '004-null-item',
    title: 'Return null item unchanged',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayGetItem($.arr, 0)',
    input: { arr: [null] },
    expected: expectOutput(null),
    source: { file: sourceFile, caseId: 'AGI-005' },
  }),
  singleExpressionCase({
    id: '005-object-item',
    title: 'Return object item unchanged',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayGetItem($.arr, 1)',
    input: { arr: [{ a: 1 }, { b: 2 }] },
    expected: expectOutput({ b: 2 }),
    source: { file: sourceFile, caseId: 'AGI-007' },
  }),
  singleExpressionCase({
    id: '006-nested-literal-list',
    title: 'Read item from nested States.Array literal list',
    group,
    tags: ['happy_path', 'nested'],
    expression: "States.ArrayGetItem(States.Array('x', 'y', 'z'), 1)",
    input: {},
    expected: expectOutput('y'),
    source: { file: sourceFile, caseId: 'AGI-020' },
  }),
  singleExpressionCase({
    id: '007-nested-object-paths',
    title: 'Read object item from nested States.Array paths',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayGetItem(States.Array($.a, $.b), 0)',
    input: { a: { k: 1 }, b: { k: 2 } },
    expected: expectOutput({ k: 1 }),
    source: { file: sourceFile, caseId: 'AGI-021' },
  }),
  singleExpressionCase({
    id: '008-context-array-item',
    title: 'Read array item from execution-input context',
    group,
    tags: ['happy_path', 'context'],
    expression: 'States.ArrayGetItem($$.Execution.Input.arr, $.idx)',
    input: { arr: ['zero', 'one', 'two'], idx: 2 },
    expected: expectOutput('two'),
    notes: 'Uses execution input context so the case stays deterministic across executors.',
    source: {
      file: sourceFile,
      caseId: 'AGI-022',
      notes: 'Adapted from the legacy runtime-context probe.',
    },
  }),
  singleExpressionCase({
    id: '009-non-array-first-arg',
    title: 'Reject non-array first argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayGetItem('not-array', 0)",
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AGI-008' },
  }),
  singleExpressionCase({
    id: '010-index-equals-length',
    title: 'Reject index equal to array length',
    group,
    tags: ['boundary', 'negative'],
    expression: 'States.ArrayGetItem($.arr, 3)',
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: {
      file: sourceFile,
      caseId: 'AGI-009',
      notes: 'Also covered by src/utils/selectPath.spec.ts as an out-of-range failure.',
    },
  }),
  singleExpressionCase({
    id: '011-negative-index',
    title: 'Reject negative index',
    group,
    tags: ['boundary', 'negative'],
    expression: 'States.ArrayGetItem($.arr, -1)',
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: {
      file: sourceFile,
      caseId: 'AGI-010',
      notes: 'Also covered by src/utils/selectPath.spec.ts as an out-of-range failure.',
    },
  }),
  singleExpressionCase({
    id: '012-empty-array-out-of-range',
    title: 'Reject far out-of-range index on empty array',
    group,
    tags: ['boundary', 'negative'],
    expression: 'States.ArrayGetItem($.arr, 999)',
    input: { arr: [] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'AWS currently returns null for empty-array out-of-range access here, while the local runtime raises a runtime error; keep this stricter characterization local-only until ArrayGetItem parity work is addressed.',
    notes:
      'Local boundary characterization retained for now. AWS currently returns { value: null } for this input.',
    source: { file: sourceFile, caseId: 'AGI-011' },
  }),
  singleExpressionCase({
    id: '013-string-index',
    title: 'Reject string index type',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayGetItem($.arr, '1')",
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AGI-012' },
  }),
  singleExpressionCase({
    id: '014-fractional-index',
    title: 'Reject fractional index',
    group,
    tags: ['type_validation', 'boundary', 'negative'],
    expression: 'States.ArrayGetItem($.arr, 1.2)',
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'AWS currently truncates the fractional index and returns the element at index 1, while the local runtime rejects non-integer indexes; keep this stricter characterization local-only until ArrayGetItem parity work is addressed.',
    notes:
      'Local boundary characterization retained for now. AWS currently returns { value: 20 } for this input.',
    source: { file: sourceFile, caseId: 'AGI-015' },
  }),
  singleExpressionCase({
    id: '015-missing-index',
    title: 'Reject missing index argument',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayGetItem($.arr)',
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AGI-018' },
  }),
  singleExpressionCase({
    id: '016-extra-argument',
    title: 'Reject extra argument arity',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayGetItem($.arr, 1, 999)',
    input: { arr: [10, 20, 30] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AGI-019' },
  }),
  singleExpressionCase({
    id: '017-empty-index-slot',
    title: 'Reject malformed call with empty index slot',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.ArrayGetItem($.arr, )',
    input: { arr: [1] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AGI-023' },
  }),
];
