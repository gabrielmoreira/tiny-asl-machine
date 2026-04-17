import { expect } from 'vite-plus/test';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayUnique';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayUnique.ts';

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

const expectOutput = (value: unknown[]) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ value });
};

export const statesArrayUniqueCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-repeated-numbers',
    title: 'Deduplicate repeated numbers',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [1, 2, 3, 3, 3, 4] },
    expected: expectOutput([1, 2, 3, 4]),
    source: {
      file: sourceFile,
      caseId: 'AUNIQ-001',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '002-repeated-strings',
    title: 'Deduplicate repeated strings while preserving first-seen order',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: ['a', 'b', 'a', 'c', 'b'] },
    expected: expectOutput(['a', 'b', 'c']),
    source: { file: sourceFile, caseId: 'AUNIQ-002' },
  }),
  singleExpressionCase({
    id: '003-empty-array',
    title: 'Empty array stays empty',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [] },
    expected: expectOutput([]),
    source: { file: sourceFile, caseId: 'AUNIQ-003' },
  }),
  singleExpressionCase({
    id: '004-booleans',
    title: 'Deduplicate booleans',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [true, false, true, false] },
    expected: expectOutput([true, false]),
    awsExecutable: false,
    skipReason:
      'AWS currently emits boolean uniques in a different order for this mixed duplicate input, so keep this order-sensitive characterization local-only until broader runtime parity work lands.',
    notes: 'AWS currently returns [false, true] for this case.',
    source: { file: sourceFile, caseId: 'AUNIQ-004' },
  }),
  singleExpressionCase({
    id: '005-null-values',
    title: 'Deduplicate null values alongside numbers',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [null, null, 1, null] },
    expected: expectOutput([null, 1]),
    source: { file: sourceFile, caseId: 'AUNIQ-005' },
  }),
  singleExpressionCase({
    id: '006-number-string-lookalikes',
    title: 'Distinguish numeric and string lookalikes while collapsing equivalent numbers',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [1, '1', 1.0, '01'] },
    expected: expectOutput([1, '1', '01']),
    notes:
      'Captures JSON-value equality where 1 and 1.0 compare equal, while strings remain distinct.',
    source: { file: sourceFile, caseId: 'AUNIQ-006' },
  }),
  singleExpressionCase({
    id: '007-identical-objects',
    title: 'Deduplicate identical objects with the same key order',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [{ a: 1 }, { a: 1 }] },
    expected: expectOutput([{ a: 1 }]),
    source: { file: sourceFile, caseId: 'AUNIQ-007' },
  }),
  singleExpressionCase({
    id: '008-object-key-order',
    title: 'Treat object key order variants as duplicates',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: {
      arr: [
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ],
    },
    expected: expectOutput([{ a: 1, b: 2 }]),
    source: { file: sourceFile, caseId: 'AUNIQ-008' },
  }),
  singleExpressionCase({
    id: '009-nested-arrays',
    title: 'Compare nested arrays structurally and positionally',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: {
      arr: [
        [1, 2],
        [1, 2],
        [2, 1],
      ],
    },
    expected: expectOutput([
      [1, 2],
      [2, 1],
    ]),
    awsExecutable: false,
    skipReason:
      'AWS currently emits structurally unique nested arrays in a different order for this case, so keep this order-sensitive characterization local-only until broader runtime parity work lands.',
    notes: 'AWS currently returns [[2, 1], [1, 2]] for this input.',
    source: { file: sourceFile, caseId: 'AUNIQ-010' },
  }),
  singleExpressionCase({
    id: '010-nested-objects',
    title: 'Deduplicate nested objects with the same structure',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [{ nested: { x: 1 } }, { nested: { x: 1 } }] },
    expected: expectOutput([{ nested: { x: 1 } }]),
    source: { file: sourceFile, caseId: 'AUNIQ-012' },
  }),
  singleExpressionCase({
    id: '011-first-seen-order',
    title: 'Preserve first-seen order when deduplicating',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [1, 2, 1, 3, 2, 4] },
    expected: expectOutput([1, 2, 3, 4]),
    source: { file: sourceFile, caseId: 'AUNIQ-014' },
  }),
  singleExpressionCase({
    id: '012-nested-intrinsic-values',
    title: 'Deduplicate values produced by a nested States.Array intrinsic',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayUnique(States.Array(1,1,2,2,3))',
    input: {},
    expected: expectOutput([1, 2, 3]),
    source: { file: sourceFile, caseId: 'AUNIQ-019' },
  }),
  singleExpressionCase({
    id: '013-execution-context',
    title: 'Read array input from execution context',
    group,
    tags: ['happy_path', 'context'],
    expression: 'States.ArrayUnique($$.Execution.Input.tags)',
    input: { tags: ['x', 'x', 'y'] },
    expected: expectOutput(['x', 'y']),
    notes: 'Execution.Input mirrors the initial state input in this harness and on AWS.',
    source: { file: sourceFile, caseId: 'AUNIQ-020' },
  }),
  singleExpressionCase({
    id: '014-non-array-argument',
    title: 'Reject a literal non-array argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayUnique('not-array')",
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    source: {
      file: sourceFile,
      caseId: 'AUNIQ-015',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '015-object-path-value',
    title: 'Reject an object value from input path',
    group,
    tags: ['type_validation', 'negative'],
    expression: 'States.ArrayUnique($.obj)',
    input: { obj: { a: 1 } },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AUNIQ-016' },
  }),
  singleExpressionCase({
    id: '016-missing-argument',
    title: 'Reject missing argument arity',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayUnique()',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AUNIQ-017' },
  }),
  singleExpressionCase({
    id: '017-extra-second-arg',
    title: 'Reject extra second argument',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayUnique($.arr, $.extra)',
    input: { arr: [1, 1], extra: 123 },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AUNIQ-018' },
  }),
  singleExpressionCase({
    id: '018-null-undefined-like',
    title: 'Document mixed null-and-undefined-like array values',
    group,
    tags: ['malformed_input', 'negative'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [null, null] },
    expected: expectOutput([null]),
    awsExecutable: false,
    skipReason:
      'The source markdown case depends on undefined-like runtime values, which are not representable in JSON execution input for AWS Step Functions.',
    notes:
      'Source matrix described [null, undefined, null]; this placeholder input collapses to [null, null] in JSON, so the local-only characterization asserts the observed deduped output.',
    source: { file: sourceFile, caseId: 'AUNIQ-021' },
  }),
  singleExpressionCase({
    id: '019-duplicate-undefined-like',
    title: 'Document duplicate undefined-like entries as a non-JSON case',
    group,
    tags: ['malformed_input', 'negative'],
    expression: 'States.ArrayUnique($.arr)',
    input: { arr: [] },
    expected: expectOutput([]),
    awsExecutable: false,
    skipReason:
      'The source markdown case depends on arrays containing only undefined values, which cannot be represented in JSON payloads sent to AWS Step Functions.',
    notes:
      'Source matrix described [undefined, undefined]; the JSON placeholder input becomes [] so the local-only characterization asserts that observed output.',
    source: { file: sourceFile, caseId: 'AUNIQ-022' },
  }),
];
