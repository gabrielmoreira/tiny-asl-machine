import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.Base64Encode';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.Base64Encode.ts';
const a9999 = 'a'.repeat(9999);
const a10000 = 'a'.repeat(10000);
const a10001 = 'a'.repeat(10001);

function expectEncodedValue(result: TestResult, expectedValue: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ value: expectedValue });
}

function expectRoundTripEncoding(result: TestResult, original: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({ value: expect.any(String) });
  const encoded = (result.output as { value: string }).value;
  expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(original);
}

function expectIntrinsicFailure(result: TestResult, causeFragment?: string) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
  if (causeFragment) {
    expect(result.cause).toContain(causeFragment);
  }
}

export const statesBase64EncodeCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-encode-ascii-literal-hello',
    title: 'encodes ASCII literal hello',
    group,
    tags: ['happy_path'],
    expression: "States.Base64Encode('hello')",
    input: {},
    expected: result => expectEncodedValue(result, 'aGVsbG8='),
    source: { file: sourceFile, caseId: 'B64E-001' },
  }),
  singleExpressionCase({
    id: '002-encode-empty-string-literal',
    title: 'encodes empty string literal',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Base64Encode('')",
    input: {},
    expected: result => expectEncodedValue(result, ''),
    source: { file: sourceFile, caseId: 'B64E-002' },
  }),
  singleExpressionCase({
    id: '003-encode-path-sourced-ascii-text',
    title: 'encodes path-sourced ASCII text',
    group,
    tags: ['happy_path'],
    expression: 'States.Base64Encode($.s)',
    input: { s: 'Data to encode' },
    expected: result => expectEncodedValue(result, 'RGF0YSB0byBlbmNvZGU='),
    source: { file: sourceFile, caseId: 'B64E-003' },
  }),
  singleExpressionCase({
    id: '004-encode-unicode-checkmark',
    title: 'encodes single BMP Unicode character',
    group,
    tags: ['happy_path', 'unicode'],
    expression: 'States.Base64Encode($.s)',
    input: { s: '✓' },
    expected: result => expectEncodedValue(result, '4pyT'),
    source: { file: sourceFile, caseId: 'B64E-004' },
  }),
  singleExpressionCase({
    id: '005-encode-japanese-text',
    title: 'encodes multibyte Unicode string',
    group,
    tags: ['happy_path', 'unicode'],
    expression: 'States.Base64Encode($.s)',
    input: { s: 'こんにちは' },
    expected: result => expectEncodedValue(result, '44GT44KT44Gr44Gh44Gv'),
    source: { file: sourceFile, caseId: 'B64E-005' },
  }),
  singleExpressionCase({
    id: '006-encode-embedded-newlines',
    title: 'encodes embedded newline characters',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Base64Encode($.s)',
    input: { s: 'line1\nline2' },
    expected: result => expectEncodedValue(result, 'bGluZTEKbGluZTI='),
    source: { file: sourceFile, caseId: 'B64E-006' },
  }),
  singleExpressionCase({
    id: '007-encode-string-with-nul',
    title: 'encodes string containing NUL',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.Base64Encode($.s)',
    input: { s: 'abc\u0000def' },
    expected: result => expectEncodedValue(result, 'YWJjAGRlZg=='),
    source: { file: sourceFile, caseId: 'B64E-007' },
  }),
  singleExpressionCase({
    id: '008-accept-9999-char-input',
    title: 'accepts 9999-character input',
    group,
    tags: ['boundary', 'aws_limit'],
    expression: 'States.Base64Encode($.s)',
    input: { s: a9999 },
    expected: result => expectRoundTripEncoding(result, a9999),
    source: { file: sourceFile, caseId: 'B64E-008' },
  }),
  singleExpressionCase({
    id: '009-accept-10000-char-input',
    title: 'accepts 10000-character input',
    group,
    tags: ['boundary', 'aws_limit'],
    expression: 'States.Base64Encode($.s)',
    input: { s: a10000 },
    expected: result => expectRoundTripEncoding(result, a10000),
    source: { file: sourceFile, caseId: 'B64E-009' },
  }),
  singleExpressionCase({
    id: '010-reject-10001-char-input',
    title: 'rejects 10001-character input',
    group,
    tags: ['negative', 'aws_limit'],
    expression: 'States.Base64Encode($.s)',
    input: { s: a10001 },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64E-010' },
  }),
  singleExpressionCase({
    id: '011-reject-numeric-argument',
    title: 'rejects numeric argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.Base64Encode(123)',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64E-011' },
  }),
  singleExpressionCase({
    id: '012-reject-object-path-argument',
    title: 'rejects object argument from path',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.Base64Encode($.obj)',
    input: { obj: {} },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64E-014' },
  }),
  singleExpressionCase({
    id: '013-reject-array-path-argument',
    title: 'rejects array argument from path',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.Base64Encode($.arr)',
    input: { arr: ['x'] },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64E-015' },
  }),
  singleExpressionCase({
    id: '014-reject-missing-argument',
    title: 'rejects missing argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: 'States.Base64Encode()',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'B64E-016' },
  }),
  singleExpressionCase({
    id: '015-reject-extra-argument',
    title: 'rejects extra argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: "States.Base64Encode('a', 'b')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'AWS should reject wrong arity even if the local runtime currently ignores extra arguments.',
    source: { file: sourceFile, caseId: 'B64E-017' },
  }),
  singleExpressionCase({
    id: '016-encode-nested-format-output',
    title: 'encodes nested States.Format output',
    group,
    tags: ['happy_path', 'nested'],
    expression: "States.Base64Encode(States.Format('{}-{}', $.a, $.b))",
    input: { a: 'x', b: 'y' },
    expected: result => expectEncodedValue(result, 'eC15'),
    source: { file: sourceFile, caseId: 'B64E-018' },
  }),
  singleExpressionCase({
    id: '017-encode-context-execution-name',
    title: 'encodes AWS execution name from context',
    group,
    tags: ['context', 'matcher'],
    expression: 'States.Base64Encode($$.Execution.Name)',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(String) });
      const encoded = (result.output as { value: string }).value;
      expect(encoded).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(Buffer.from(encoded, 'base64').toString('utf8').length).toBeGreaterThan(0);
    },
    source: { file: sourceFile, caseId: 'B64E-019' },
  }),
  singleExpressionCase({
    id: '018-reject-missing-path-result',
    title: 'rejects missing path result',
    group,
    tags: ['negative', 'invalid_runtime_input'],
    expression: 'States.Base64Encode($.missing)',
    input: {},
    expected: result => expectIntrinsicFailure(result, "could not be found in the input '{}'"),
    source: { file: sourceFile, caseId: 'B64E-020' },
  }),
  singleExpressionCase({
    id: '019-encode-single-space',
    title: 'encodes single space without trimming',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Base64Encode(' ')",
    input: {},
    expected: result => expectEncodedValue(result, 'IA=='),
    source: { file: sourceFile, caseId: 'B64E-021' },
  }),
  singleExpressionCase({
    id: '020-encode-astral-unicode-character',
    title: 'encodes astral-plane Unicode character',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Base64Encode('🚀')",
    input: {},
    expected: result => expectEncodedValue(result, '8J+agA=='),
    source: { file: sourceFile, caseId: 'B64E-022' },
  }),
];
