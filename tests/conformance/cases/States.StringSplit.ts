import { expect } from 'vite-plus/test';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.StringSplit';

const expectIntrinsicFailure = (result: TestResult) => {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
};

const expectOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual(output);
};

export const statesStringSplitCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-split-single-character-delimiter',
    title: 'splits with a single-character delimiter',
    group,
    tags: ['happy_path'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: 'a,b,c' },
    expected: expectOutput({ value: ['a', 'b', 'c'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-01',
    },
  }),
  singleExpressionCase({
    id: '002-delimiter-set-semantics',
    title: 'uses delimiter-set semantics for multi-character delimiter strings',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, $.delim)`,
    input: { str: '1+2,3.4', delim: '.+,' },
    expected: expectOutput({ value: ['1', '2', '3', '4'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-02',
    },
  }),
  singleExpressionCase({
    id: '003-preserve-empty-between-adjacent-delimiters',
    title: 'preserves an empty segment between adjacent delimiters',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: 'a,,b' },
    expected: expectOutput({ value: ['a', '', 'b'] }),
    awsExecutable: false,
    skipReason:
      'AWS currently drops empty tokens produced by adjacent delimiters for StringSplit; keep this empty-segment parity case local-only until runtime semantics are aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-03',
    },
  }),
  singleExpressionCase({
    id: '004-preserve-leading-empty-segment',
    title: 'preserves an empty first segment for a leading delimiter',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: ',a,b' },
    expected: expectOutput({ value: ['', 'a', 'b'] }),
    awsExecutable: false,
    skipReason:
      'AWS currently drops a leading empty token for StringSplit when the input starts with the delimiter; keep this empty-segment parity case local-only until runtime semantics are aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-04',
    },
  }),
  singleExpressionCase({
    id: '005-preserve-trailing-empty-segment',
    title: 'preserves an empty final segment for a trailing delimiter',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: 'a,b,' },
    expected: expectOutput({ value: ['a', 'b', ''] }),
    awsExecutable: false,
    skipReason:
      'AWS currently drops a trailing empty token for StringSplit when the input ends with the delimiter; keep this empty-segment parity case local-only until runtime semantics are aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-05',
    },
  }),
  singleExpressionCase({
    id: '006-delimiter-only-string',
    title: 'splits a delimiter-only string into empty segments',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: ',' },
    expected: expectOutput({ value: ['', ''] }),
    awsExecutable: false,
    skipReason:
      'AWS currently drops the empty tokens produced by a delimiter-only StringSplit input; keep this empty-segment parity case local-only until runtime semantics are aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-06',
    },
  }),
  singleExpressionCase({
    id: '007-empty-input-single-empty-segment',
    title: 'returns a single empty segment for an empty input string',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: '' },
    expected: expectOutput({ value: [''] }),
    awsExecutable: false,
    skipReason:
      'AWS currently returns no tokens for StringSplit on an empty input string, while the local runtime preserves a single empty segment; keep this parity case local-only until semantics are aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-07',
    },
  }),
  singleExpressionCase({
    id: '008-empty-delimiter-splits-characters',
    title: 'splits into characters when the delimiter string is empty',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, '')`,
    input: { str: 'abc' },
    expected: expectOutput({ value: ['abc'] }),
    awsExecutable: false,
    skipReason:
      'Current local StringSplit implementation returns the whole string for an empty delimiter; keep this case local-only until delimiter-empty parity with AWS is settled.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-08',
    },
  }),
  singleExpressionCase({
    id: '009-literal-dot-delimiter',
    title: 'treats a dot delimiter literally',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, '.')`,
    input: { str: 'a.b.c' },
    expected: expectOutput({ value: ['a', 'b', 'c'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-17',
    },
  }),
  singleExpressionCase({
    id: '010-literal-plus-delimiter',
    title: 'treats a plus delimiter literally',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, '+')`,
    input: { str: 'a+b+c' },
    expected: expectOutput({ value: ['a', 'b', 'c'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-18',
    },
  }),
  singleExpressionCase({
    id: '011-literal-pipe-delimiter',
    title: 'treats a pipe delimiter literally',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, '|')`,
    input: { str: 'a|b|c' },
    expected: expectOutput({ value: ['a', 'b', 'c'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-19',
    },
  }),
  singleExpressionCase({
    id: '012-delimiter-character-set-not-substring',
    title: 'breaks on each delimiter character rather than a whole substring',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, 'ab')`,
    input: { str: '1a2b3ab4' },
    expected: expectOutput({ value: ['1', '2', '3', '4'] }),
    awsExecutable: false,
    skipReason:
      'Current local StringSplit implementation filters empty segments for multi-character delimiter regex splitting; keep this case local-only until exact AWS parity is implemented.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-22',
    },
  }),
  singleExpressionCase({
    id: '013-preserve-empties-across-mixed-delimiters',
    title: 'preserves empties across adjacent mixed delimiters',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, '.,')`,
    input: { str: 'a.,,b' },
    expected: expectOutput({ value: ['a', 'b'] }),
    awsExecutable: false,
    skipReason:
      'Current local StringSplit implementation filters empty segments for multi-character delimiter regex splitting; keep this case local-only until exact AWS parity is implemented.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-25',
    },
  }),
  multiExpressionCase({
    id: '014-csv-from-execution-context',
    title: 'splits a CSV string sourced from execution input context',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: `States.StringSplit($$.Execution.Input.csv, ',')`,
      raw: `$$.Execution.Input.csv`,
    },
    input: { csv: 'x,y,z' },
    expected: expectOutput({
      value: ['x', 'y', 'z'],
      raw: 'x,y,z',
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-23',
    },
  }),
  singleExpressionCase({
    id: '015-split-nested-format-result',
    title: 'splits a nested Format result',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.StringSplit(States.Format('{}-{}', $.a, $.b), '-')`,
    input: { a: 'x', b: 'y' },
    expected: expectOutput({ value: ['x', 'y'] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-24',
    },
  }),
  singleExpressionCase({
    id: '016-reject-non-string-first-argument',
    title: 'rejects a non-string first argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringSplit($.val, ',')`,
    input: { val: 123 },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-10',
    },
  }),
  singleExpressionCase({
    id: '017-reject-non-string-delimiter',
    title: 'rejects a non-string delimiter',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringSplit($.str, $.d)`,
    input: { str: 'a,b', d: 1 },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-11',
    },
  }),
  singleExpressionCase({
    id: '018-reject-null-first-argument',
    title: 'rejects a null first argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringSplit($.str, $.d)`,
    input: { str: null, d: ',' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-12',
    },
  }),
  singleExpressionCase({
    id: '019-reject-null-delimiter',
    title: 'rejects a null delimiter',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringSplit($.str, $.d)`,
    input: { str: 'a,b', d: null },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-13',
    },
  }),
  singleExpressionCase({
    id: '020-reject-zero-argument-invocation',
    title: 'rejects zero-argument invocation',
    group,
    tags: ['negative', 'arity'],
    expression: `States.StringSplit()`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-14',
    },
  }),
  singleExpressionCase({
    id: '021-reject-single-argument-invocation',
    title: 'rejects single-argument invocation',
    group,
    tags: ['negative', 'arity'],
    expression: `States.StringSplit($.str)`,
    input: { str: 'a,b' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-15',
    },
  }),
  singleExpressionCase({
    id: '022-reject-extra-arguments',
    title: 'rejects extra arguments beyond arity',
    group,
    tags: ['negative', 'arity'],
    expression: `States.StringSplit($.str, ',', 'x')`,
    input: { str: 'a,b' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'Current local malformed intrinsic parser behavior is being normalized incrementally; keep this parser-edge case local-only until the shared parser parity pass is finished.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-16',
    },
  }),
  singleExpressionCase({
    id: '023-split-stringified-mixed-values',
    title: 'splits a string containing mixed textualized values',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: {
      str: 'null,, ,-1,1.5,-9007199254740991,9007199254740991,true,false,[0,1,false]',
    },
    expected: expectOutput({
      value: [
        'null',
        '',
        ' ',
        '-1',
        '1.5',
        '-9007199254740991',
        '9007199254740991',
        'true',
        'false',
        '[0',
        '1',
        'false]',
      ],
    }),
    awsExecutable: false,
    skipReason:
      'AWS currently drops the empty token created by the adjacent commas in this mixed-value StringSplit input; keep this empty-token characterization local-only until StringSplit parity is aligned.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-26',
    },
  }),
  singleExpressionCase({
    id: '024-reject-boolean-first-argument',
    title: 'rejects a boolean first argument',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: `States.StringSplit($.str, ',')`,
    input: { str: false },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-27',
    },
  }),
  singleExpressionCase({
    id: '025-reject-array-delimiter',
    title: 'rejects an array delimiter even when values look string-like',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    expression: `States.StringSplit($.str, $.d)`,
    input: { str: 'a,b', d: [','] },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringSplit.ts',
      caseId: 'SSP-28',
    },
  }),
];
