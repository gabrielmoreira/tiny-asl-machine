import { expect } from 'vite-plus/test';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.ArrayContains';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.ArrayContains.ts';

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

export const statesArrayContainsCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-present-number',
    title: 'Find present numeric primitive',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayContains($.arr, 2)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-001' },
  }),
  singleExpressionCase({
    id: '002-absent-number',
    title: 'Return false for absent numeric primitive',
    group,
    tags: ['happy_path'],
    expression: 'States.ArrayContains($.arr, 5)',
    input: { arr: [1, 2, 3] },
    expected: expectOutput(false),
    source: { file: sourceFile, caseId: 'AC-002' },
  }),
  singleExpressionCase({
    id: '003-present-string',
    title: 'Find present string primitive',
    group,
    tags: ['happy_path'],
    expression: "States.ArrayContains($.arr, 'C')",
    input: { arr: ['A', 'B', 'C'] },
    expected: expectOutput(true),
    source: {
      file: sourceFile,
      caseId: 'AC-003',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '004-present-null',
    title: 'Find present null value',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayContains($.arr, null)',
    input: { arr: [1, null, 3] },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-005' },
  }),
  singleExpressionCase({
    id: '005-object-from-path',
    title: 'Find structurally equal object from input path',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: { arr: [{ a: 1 }, { b: 2 }], target: { a: 1 } },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-008' },
  }),
  singleExpressionCase({
    id: '006-object-key-order',
    title: 'Treat object key order as structurally equal',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: { arr: [{ a: 1, b: 2 }], target: { b: 2, a: 1 } },
    expected: expectOutput(true),
    awsExecutable: false,
    skipReason:
      'AWS currently does not treat reordered object keys as matching in States.ArrayContains for this case, while local performs structural equality; keep this characterization local-only until shared object-comparison parity work is tackled.',
    notes:
      'Local structural-equality characterization retained for now. AWS currently returns { value: false } for this input.',
    source: {
      file: sourceFile,
      caseId: 'AC-009',
      notes: 'Also covered by src/utils/selectPath.spec.ts object-equality coverage.',
    },
  }),
  singleExpressionCase({
    id: '007-nested-array',
    title: 'Find structurally equal nested array',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: {
      arr: [
        [1, 2],
        [3, 4],
      ],
      target: [1, 2],
    },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-010' },
  }),
  singleExpressionCase({
    id: '008-empty-array',
    title: 'Return false for empty arrays',
    group,
    tags: ['boundary'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: { arr: [], target: 1 },
    expected: expectOutput(false),
    source: { file: sourceFile, caseId: 'AC-012' },
  }),
  singleExpressionCase({
    id: '009-nested-primitive-array',
    title: 'Search nested intrinsic-produced primitive array',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayContains(States.Array(1, 2, 3), 2)',
    input: {},
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-019' },
  }),
  singleExpressionCase({
    id: '010-nested-object-array',
    title: 'Search nested intrinsic-produced object array',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.ArrayContains(States.Array($.obj1, $.obj2), $.target)',
    input: { obj1: { a: 1 }, obj2: { b: 2 }, target: { b: 2 } },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-020' },
  }),
  singleExpressionCase({
    id: '011-context-target',
    title: 'Search for execution-input target value through context',
    group,
    tags: ['happy_path', 'context'],
    expression: 'States.ArrayContains($.arr, $$.Execution.Input.target)',
    input: { arr: ['alpha', 'beta', 'gamma'], target: 'beta' },
    expected: expectOutput(true),
    notes: 'Uses execution input context so the case stays deterministic across executors.',
    source: {
      file: sourceFile,
      caseId: 'AC-021',
      notes: 'Adapted from the legacy runtime-context probe.',
    },
  }),
  singleExpressionCase({
    id: '012-object-extra-field',
    title: 'Reject near-match object with extra field',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: { arr: [{ a: 1 }], target: { a: 1, extra: null } },
    expected: expectOutput(false),
    source: { file: sourceFile, caseId: 'AC-024' },
  }),
  singleExpressionCase({
    id: '013-non-array-first-arg',
    title: 'Reject non-array first argument',
    group,
    tags: ['type_validation', 'negative'],
    expression: "States.ArrayContains('not-array', 'x')",
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    source: {
      file: sourceFile,
      caseId: 'AC-013',
      notes: 'Also covered by src/utils/selectPath.spec.ts.',
    },
  }),
  singleExpressionCase({
    id: '014-missing-second-arg',
    title: 'Reject missing second argument',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayContains($.arr)',
    input: { arr: [1, 2, 3] },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AC-014' },
  }),
  singleExpressionCase({
    id: '015-extra-third-arg',
    title: 'Reject extra third argument',
    group,
    tags: ['arity', 'negative'],
    expression: 'States.ArrayContains($.arr, 2, 999)',
    input: { arr: [1, 2, 3] },
    expected: expectFailure({ error: 'States.Runtime' }),
    source: { file: sourceFile, caseId: 'AC-015' },
  }),
  singleExpressionCase({
    id: '016-trailing-comma',
    title: 'Reject malformed call with trailing comma',
    group,
    tags: ['parser_error', 'malformed_input', 'negative'],
    expression: 'States.ArrayContains($.arr, )',
    input: { arr: [1] },
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: { file: sourceFile, caseId: 'AC-016' },
  }),
  singleExpressionCase({
    id: '017-undefined-like-membership',
    title: 'Document undefined-like membership scenario',
    group,
    tags: ['malformed_input', 'negative'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: {},
    expected: expectFailure({ error: 'States.Runtime' }),
    awsExecutable: false,
    skipReason:
      'The source scenario depends on literal undefined values, which are not representable in JSON execution input for AWS Step Functions.',
    notes:
      'Retained as a traceable catalog entry only; the placeholder input intentionally does not try to simulate undefined in JSON.',
    source: { file: sourceFile, caseId: 'AC-017' },
  }),
  singleExpressionCase({
    id: '018-no-bool-number-coercion',
    title: 'does not coerce booleans to matching numeric primitives',
    group,
    tags: ['boundary', 'mixed_types'],
    expression: 'States.ArrayContains($.arr, false)',
    input: { arr: [0, 1, -1, -1.5] },
    expected: expectOutput(false),
    source: { file: sourceFile, caseId: 'AC-025' },
  }),
  singleExpressionCase({
    id: '019-no-string-number-coercion-with-boundaries',
    title: 'does not coerce numeric-looking strings to boundary numbers',
    group,
    tags: ['boundary', 'mixed_types'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: {
      arr: ['-1', '-1.5', '-9007199254740991', '9007199254740991'],
      target: 9007199254740991,
    },
    expected: expectOutput(false),
    awsExecutable: false,
    skipReason:
      'AWS currently matches this numeric target against the stringified boundary value, while local keeps string and number membership distinct; keep this characterization local-only until ArrayContains parity work is tackled.',
    notes:
      'Local mixed-type characterization retained for now. AWS currently returns { value: true } for this input.',
    source: { file: sourceFile, caseId: 'AC-026' },
  }),
  singleExpressionCase({
    id: '020-mixed-bag-nested-array',
    title: 'finds an exact nested array inside a mixed primitive bag',
    group,
    tags: ['boundary', 'mixed_types', 'nested'],
    expression: 'States.ArrayContains($.arr, $.target)',
    input: {
      arr: [null, '', ' ', 0, 1, true, false, [0, 1, false]],
      target: [0, 1, false],
    },
    expected: expectOutput(true),
    source: { file: sourceFile, caseId: 'AC-027' },
  }),
  singleExpressionCase({
    id: '021-no-string-bool-coercion',
    title: 'does not coerce booleans to matching string values',
    group,
    tags: ['boundary', 'mixed_types'],
    expression: 'States.ArrayContains($.arr, true)',
    input: { arr: ['true', 'false', 'maybe'] },
    expected: expectOutput(false),
    awsExecutable: false,
    skipReason:
      'AWS currently matches a boolean true target against the string value "true", while local keeps boolean and string membership distinct; keep this characterization local-only until ArrayContains parity work is tackled.',
    notes:
      'Local mixed-type characterization retained for now. AWS currently returns { value: true } for this input.',
    source: { file: sourceFile, caseId: 'AC-028' },
  }),
];
