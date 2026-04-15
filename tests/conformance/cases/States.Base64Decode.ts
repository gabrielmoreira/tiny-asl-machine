import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.Base64Decode';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.Base64Decode.ts';
const base64A9999 = 'A'.repeat(9999);
const base64A10000 = 'A'.repeat(10000);
const base64A10001 = 'A'.repeat(10001);

function expectDecodedValue(result: TestResult, expectedValue: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ value: expectedValue });
}

function expectIntrinsicFailure(result: TestResult, causeFragment?: string) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
  if (causeFragment) {
    expect(result.cause).toContain(causeFragment);
  }
}

export const statesBase64DecodeCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-decode-canonical-ascii-literal',
    title: 'decodes canonical ASCII literal',
    group,
    tags: ['happy_path'],
    expression: "States.Base64Decode('aGVsbG8=')",
    input: {},
    expected: result => expectDecodedValue(result, 'hello'),
    source: { file: sourceFile, caseId: 'B64D-001' },
  }),
  singleExpressionCase({
    id: '002-decode-empty-string-literal',
    title: 'decodes empty string literal',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Base64Decode('')",
    input: {},
    expected: result => expectDecodedValue(result, ''),
    source: { file: sourceFile, caseId: 'B64D-002' },
  }),
  singleExpressionCase({
    id: '003-decode-path-sourced-base64-text',
    title: 'decodes path-sourced Base64 text',
    group,
    tags: ['happy_path'],
    expression: 'States.Base64Decode($.s)',
    input: { s: 'RGF0YSB0byBlbmNvZGU=' },
    expected: result => expectDecodedValue(result, 'Data to encode'),
    source: { file: sourceFile, caseId: 'B64D-003' },
  }),
  singleExpressionCase({
    id: '004-decode-utf8-checkmark-text',
    title: 'decodes UTF-8 checkmark text',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Base64Decode('4pyT')",
    input: {},
    expected: result => expectDecodedValue(result, '✓'),
    source: { file: sourceFile, caseId: 'B64D-004' },
  }),
  singleExpressionCase({
    id: '005-decode-japanese-text',
    title: 'decodes multibyte Japanese text',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Base64Decode('44GT44KT44Gr44Gh44Gv')",
    input: {},
    expected: result => expectDecodedValue(result, 'こんにちは'),
    source: { file: sourceFile, caseId: 'B64D-005' },
  }),
  singleExpressionCase({
    id: '006-observe-9999-char-boundary',
    title: 'observes 9999-character Base64 boundary',
    group,
    tags: ['boundary', 'aws_limit', 'malformed_input'],
    expression: 'States.Base64Decode($.s)',
    input: { s: base64A9999 },
    expected: result => {
      expect([undefined, 'States.Runtime']).toContain(result.error);
      if (result.error === undefined) {
        expect(result.cause).toBeUndefined();
        expect(result.output).toMatchObject({ value: expect.any(String) });
      } else {
        expect(result.cause).toEqual(expect.any(String));
      }
    },
    notes:
      'This intentionally ambiguous boundary case preserves the observation-oriented catalog behavior.',
    source: { file: sourceFile, caseId: 'B64D-006' },
  }),
  singleExpressionCase({
    id: '007-observe-10000-char-boundary',
    title: 'observes 10000-character Base64 boundary',
    group,
    tags: ['boundary', 'aws_limit', 'malformed_input'],
    expression: 'States.Base64Decode($.s)',
    input: { s: base64A10000 },
    expected: result => {
      expect([undefined, 'States.Runtime']).toContain(result.error);
      if (result.error === undefined) {
        expect(result.cause).toBeUndefined();
        expect(result.output).toMatchObject({ value: expect.any(String) });
      } else {
        expect(result.cause).toEqual(expect.any(String));
      }
    },
    notes:
      'AWS documentation caps length but repeated alphabet content may also probe decoder validation order.',
    source: { file: sourceFile, caseId: 'B64D-007' },
  }),
  singleExpressionCase({
    id: '008-reject-10001-char-input',
    title: 'rejects 10001-character Base64 input',
    group,
    tags: ['negative', 'aws_limit'],
    expression: 'States.Base64Decode($.s)',
    input: { s: base64A10001 },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64D-008' },
  }),
  singleExpressionCase({
    id: '009-reject-numeric-argument',
    title: 'rejects numeric argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.Base64Decode(123)',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64D-009' },
  }),
  singleExpressionCase({
    id: '010-reject-object-path-argument',
    title: 'rejects object argument from path',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.Base64Decode($.obj)',
    input: { obj: {} },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64D-012' },
  }),
  singleExpressionCase({
    id: '011-reject-missing-argument',
    title: 'rejects missing argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: 'States.Base64Decode()',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64D-013' },
  }),
  singleExpressionCase({
    id: '012-reject-extra-argument',
    title: 'rejects extra argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: "States.Base64Decode('aGVsbG8=', 'extra')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'AWS should reject wrong arity even if the local runtime currently ignores extra arguments.',
    source: { file: sourceFile, caseId: 'B64D-014' },
  }),
  singleExpressionCase({
    id: '013-fail-illegal-base64-characters',
    title: 'fails on illegal Base64 characters',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Base64Decode('!!!invalid!!!')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'Preserves local strict-decoder coverage for obviously malformed Base64 text even though AWS currently returns decoded output for this probe.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this malformed Base64 probe and returns output instead of surfacing a decode error; keep it as a local-only characterization until broader Base64 parity work is scheduled.',
    source: { file: sourceFile, caseId: 'B64D-015' },
  }),
  singleExpressionCase({
    id: '014-fail-mod-4-short-input',
    title: 'fails on mod-4 short Base64 input',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Base64Decode('abc')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'Preserves local strict-decoder coverage for short mod-4 Base64 text even though AWS currently decodes this probe.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this short malformed Base64 probe and returns output instead of surfacing a decode error; keep it as a local-only characterization until broader Base64 parity work is scheduled.',
    source: { file: sourceFile, caseId: 'B64D-017' },
  }),
  singleExpressionCase({
    id: '015-fail-misplaced-internal-padding',
    title: 'fails on misplaced internal padding',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Base64Decode('ab==cd')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'Preserves local strict-decoder coverage for misplaced internal padding even though AWS currently decodes this probe.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this malformed padding probe and returns output instead of surfacing a decode error; keep it as a local-only characterization until broader Base64 parity work is scheduled.',
    source: { file: sourceFile, caseId: 'B64D-019' },
  }),
  singleExpressionCase({
    id: '016-decode-padded-control-value',
    title: 'decodes properly padded control value',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Base64Decode('YWJjZA==')",
    input: {},
    expected: result => expectDecodedValue(result, 'abcd'),
    source: { file: sourceFile, caseId: 'B64D-021' },
  }),
  singleExpressionCase({
    id: '017-decode-space-character',
    title: 'decodes single space character',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Base64Decode('IA==')",
    input: {},
    expected: result => expectDecodedValue(result, ' '),
    source: { file: sourceFile, caseId: 'B64D-022' },
  }),
  singleExpressionCase({
    id: '018-decode-string-with-nul-byte',
    title: 'decodes string containing NUL byte',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Base64Decode($.s)',
    input: { s: 'YWJjAGRlZg==' },
    expected: result => expectDecodedValue(result, 'abc\u0000def'),
    source: { file: sourceFile, caseId: 'B64D-023' },
  }),
  singleExpressionCase({
    id: '019-fail-surrounding-space-probe',
    title: 'fails on surrounding space tolerance probe',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Base64Decode(' YWJjZA== ')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'Preserves local whitespace-tolerance coverage for Base64 decode inputs; AWS currently tolerates surrounding spaces for this probe.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts this probe after tolerating surrounding spaces, while the local runtime rejects it as malformed Base64.',
    source: { file: sourceFile, caseId: 'B64D-024' },
  }),
  singleExpressionCase({
    id: '020-fail-embedded-newline-probe',
    title: 'fails on embedded newline tolerance probe',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Base64Decode('YWJj\\nZA==')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'Preserves local embedded-newline rejection coverage; AWS rejects this expression earlier as an invalid intrinsic string rather than as a runtime Base64 decode failure.',
    awsExecutable: false,
    skipReason:
      'AWS rejects this probe at intrinsic-definition validation time instead of producing a States.Runtime decode error, so keep it local-only for now.',
    source: { file: sourceFile, caseId: 'B64D-025' },
  }),
  singleExpressionCase({
    id: '021-round-trip-nested-encode-output',
    title: 'round-trips nested Base64Encode output',
    group,
    tags: ['happy_path', 'nested'],
    expression: 'States.Base64Decode(States.Base64Encode($.s))',
    input: { s: 'hello' },
    expected: result => expectDecodedValue(result, 'hello'),
    source: { file: sourceFile, caseId: 'B64D-029' },
  }),
  singleExpressionCase({
    id: '022-decode-format-wrapped-base64',
    title: 'decodes Base64 text wrapped by States.Format',
    group,
    tags: ['happy_path', 'nested'],
    expression: "States.Base64Decode(States.Format('{}', $.b64))",
    input: { b64: 'aGVsbG8=' },
    expected: result => expectDecodedValue(result, 'hello'),
    source: { file: sourceFile, caseId: 'B64D-030' },
  }),
  singleExpressionCase({
    id: '023-decode-context-execution-name',
    title: 'decodes execution name from context when it is Base64',
    group,
    tags: ['context', 'matcher'],
    expression: 'States.Base64Decode($$.Execution.Name)',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'This remains valuable for local/context coverage, but the AWS harness cannot force execution names to be valid Base64.',
    awsExecutable: false,
    skipReason:
      'Current AWS harness generates execution names automatically and does not guarantee that $$.Execution.Name is valid Base64 text.',
    source: { file: sourceFile, caseId: 'B64D-031' },
  }),
  singleExpressionCase({
    id: '024-reject-missing-path-result',
    title: 'rejects missing path result',
    group,
    tags: ['negative', 'invalid_runtime_input'],
    expression: 'States.Base64Decode($.missing)',
    input: {},
    expected: result => expectIntrinsicFailure(result, "could not be found in the input '{}'"),
    source: { file: sourceFile, caseId: 'B64D-032' },
  }),
];
