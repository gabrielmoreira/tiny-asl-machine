import { expect } from 'vitest';
import { singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.Hash';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.Hash.ts';
const a9999 = 'a'.repeat(9999);
const a10000 = 'a'.repeat(10000);
const a10001 = 'a'.repeat(10001);

function expectHashValue(result: TestResult, expectedValue: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ value: expectedValue });
}

function expectHashShape(result: TestResult, length: number) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({ value: expect.any(String) });
  expect((result.output as { value: string }).value).toMatch(new RegExp(`^[0-9a-f]{${length}}$`));
}

function expectIntrinsicFailure(result: TestResult, causeFragment?: string) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
  if (causeFragment) {
    expect(result.cause).toContain(causeFragment);
  }
}

export const statesHashCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-hash-hello-md5',
    title: 'hashes hello with MD5',
    group,
    tags: ['happy_path'],
    expression: "States.Hash('hello', 'MD5')",
    input: {},
    expected: result => expectHashValue(result, '5d41402abc4b2a76b9719d911017c592'),
    source: { file: sourceFile, caseId: 'HASH-001' },
  }),
  singleExpressionCase({
    id: '002-hash-hello-sha-1',
    title: 'hashes hello with SHA-1',
    group,
    tags: ['happy_path'],
    expression: "States.Hash('hello', 'SHA-1')",
    input: {},
    expected: result => expectHashValue(result, 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'),
    source: { file: sourceFile, caseId: 'HASH-002' },
  }),
  singleExpressionCase({
    id: '003-hash-hello-sha-256',
    title: 'hashes hello with SHA-256',
    group,
    tags: ['happy_path'],
    expression: "States.Hash('hello', 'SHA-256')",
    input: {},
    expected: result =>
      expectHashValue(result, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'),
    source: { file: sourceFile, caseId: 'HASH-003' },
  }),
  singleExpressionCase({
    id: '004-hash-hello-sha-384',
    title: 'hashes hello with SHA-384',
    group,
    tags: ['happy_path'],
    expression: "States.Hash('hello', 'SHA-384')",
    input: {},
    expected: result =>
      expectHashValue(
        result,
        '59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f'
      ),
    source: { file: sourceFile, caseId: 'HASH-004' },
  }),
  singleExpressionCase({
    id: '005-hash-hello-sha-512',
    title: 'hashes hello with SHA-512',
    group,
    tags: ['happy_path'],
    expression: "States.Hash('hello', 'SHA-512')",
    input: {},
    expected: result =>
      expectHashValue(
        result,
        '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043'
      ),
    source: { file: sourceFile, caseId: 'HASH-005' },
  }),
  singleExpressionCase({
    id: '006-repeat-literal-sha-256-deterministically',
    title: 'repeats literal SHA-256 deterministically',
    group,
    tags: ['happy_path', 'deterministic'],
    expression: "States.Hash('hello', 'SHA-256')",
    input: {},
    expected: result =>
      expectHashValue(result, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'),
    source: { file: sourceFile, caseId: 'HASH-006' },
  }),
  singleExpressionCase({
    id: '007-hash-empty-string-sha-256',
    title: 'hashes empty string with SHA-256',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Hash('', 'SHA-256')",
    input: {},
    expected: result =>
      expectHashValue(result, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'),
    source: { file: sourceFile, caseId: 'HASH-007' },
  }),
  singleExpressionCase({
    id: '008-hash-unicode-checkmark-sha-256',
    title: 'hashes Unicode checkmark with SHA-256',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Hash($.s, 'SHA-256')",
    input: { s: '✓' },
    expected: result =>
      expectHashValue(result, '1dabba21cdad44541f6b15796f8d22978fc7ea10c46aeceeeeb66c23b3ac7604'),
    source: { file: sourceFile, caseId: 'HASH-008' },
  }),
  singleExpressionCase({
    id: '009-hash-japanese-text-sha-256',
    title: 'hashes Japanese text with SHA-256',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Hash($.s, 'SHA-256')",
    input: { s: 'こんにちは' },
    expected: result =>
      expectHashValue(result, '125aeadf27b0459b8760c13a3d80912dfa8a81a68261906f60d87f4a0268646c'),
    source: { file: sourceFile, caseId: 'HASH-009' },
  }),
  singleExpressionCase({
    id: '010-hash-string-with-nul-md5',
    title: 'hashes string containing NUL with MD5',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Hash($.s, 'MD5')",
    input: { s: 'abc\u0000def' },
    expected: result => expectHashValue(result, 'a5e4d5963ae44c1f4bfb37b1a3d55a3c'),
    source: { file: sourceFile, caseId: 'HASH-010' },
  }),
  singleExpressionCase({
    id: '011-accept-9999-char-input',
    title: 'accepts 9999-character hash input',
    group,
    tags: ['boundary', 'aws_limit', 'matcher'],
    expression: "States.Hash($.s, 'SHA-256')",
    input: { s: a9999 },
    expected: result => expectHashShape(result, 64),
    source: { file: sourceFile, caseId: 'HASH-011' },
  }),
  singleExpressionCase({
    id: '012-accept-10000-char-input',
    title: 'accepts 10000-character hash input',
    group,
    tags: ['boundary', 'aws_limit', 'matcher'],
    expression: "States.Hash($.s, 'SHA-256')",
    input: { s: a10000 },
    expected: result => expectHashShape(result, 64),
    source: { file: sourceFile, caseId: 'HASH-012' },
  }),
  singleExpressionCase({
    id: '013-reject-10001-char-input',
    title: 'rejects 10001-character hash input',
    group,
    tags: ['negative', 'aws_limit'],
    expression: "States.Hash($.s, 'SHA-256')",
    input: { s: a10001 },
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-013' },
  }),
  singleExpressionCase({
    id: '014-reject-numeric-data-argument',
    title: 'rejects numeric data argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.Hash(123, 'SHA-256')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'AWS currently hashes numeric input by stringifying it, while the local runtime still rejects non-string data arguments; keep this as a local-only characterization until broader intrinsic parity work is scheduled.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts numeric data input for States.Hash and returns a digest instead of surfacing an invalid-arguments failure.',
    source: { file: sourceFile, caseId: 'HASH-014' },
  }),
  singleExpressionCase({
    id: '015-reject-object-data-path',
    title: 'rejects object data argument from path',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.Hash($.obj, 'SHA-256')",
    input: { obj: {} },
    expected: result => expectIntrinsicFailure(result),
    notes:
      'AWS currently hashes object input by stringifying it, while the local runtime still rejects object data arguments; keep this as a local-only characterization until broader intrinsic parity work is scheduled.',
    awsExecutable: false,
    skipReason:
      'AWS currently accepts object data input for States.Hash and returns a digest instead of surfacing an invalid-arguments failure.',
    source: { file: sourceFile, caseId: 'HASH-017' },
  }),
  singleExpressionCase({
    id: '016-reject-numeric-algorithm-argument',
    title: 'rejects numeric algorithm argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.Hash('hello', 123)",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-018' },
  }),
  singleExpressionCase({
    id: '017-reject-missing-hash-arguments',
    title: 'rejects missing hash arguments',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: 'States.Hash()',
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-021' },
  }),
  singleExpressionCase({
    id: '018-reject-single-hash-argument',
    title: 'rejects single hash argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: "States.Hash('hello')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-022' },
  }),
  singleExpressionCase({
    id: '019-reject-extra-hash-argument',
    title: 'rejects extra hash argument',
    group,
    tags: ['negative', 'invalid_arity'],
    expression: "States.Hash('hello', 'SHA-256', 'extra')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    notes:
      'AWS should reject wrong arity even if the local runtime currently ignores extra arguments.',
    source: { file: sourceFile, caseId: 'HASH-023' },
  }),
  singleExpressionCase({
    id: '020-reject-unsupported-algorithm-token',
    title: 'rejects unsupported algorithm token',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', 'UNSUPPORTED')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-024' },
  }),
  singleExpressionCase({
    id: '021-reject-lowercase-algorithm-token',
    title: 'rejects lowercase algorithm normalization',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', 'sha-256')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-025' },
  }),
  singleExpressionCase({
    id: '022-reject-hyphenless-algorithm-token',
    title: 'rejects hyphenless algorithm normalization',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', 'SHA256')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-026' },
  }),
  singleExpressionCase({
    id: '023-reject-blank-algorithm-string',
    title: 'rejects blank algorithm string',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', '')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-030' },
  }),
  singleExpressionCase({
    id: '024-reject-md-5-variant',
    title: 'rejects MD-5 spelling variant',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', 'MD-5')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-031' },
  }),
  singleExpressionCase({
    id: '025-reject-unsupported-sha-257-token',
    title: 'rejects unsupported SHA-257 token',
    group,
    tags: ['negative', 'malformed_input'],
    expression: "States.Hash('data', 'SHA-257')",
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: { file: sourceFile, caseId: 'HASH-032' },
  }),
  singleExpressionCase({
    id: '026-repeat-path-sourced-hash-deterministically',
    title: 'repeats path-sourced hash deterministically',
    group,
    tags: ['happy_path', 'deterministic'],
    expression: 'States.Hash($.s, $.algo)',
    input: { s: 'Data to encode', algo: 'MD5' },
    expected: result => expectHashValue(result, 'ca405671828a177e26947171bbe1e352'),
    source: { file: sourceFile, caseId: 'HASH-033' },
  }),
  singleExpressionCase({
    id: '027-hash-nested-format-output',
    title: 'hashes nested States.Format output',
    group,
    tags: ['happy_path', 'nested'],
    expression: "States.Hash(States.Format('{}:{}', $.a, $.b), 'SHA-256')",
    input: { a: 'x', b: 'y' },
    expected: result =>
      expectHashValue(result, '1274e286686b54fe765ec40735665b4bf789cee2a5b22124c5e0491a88e15271'),
    source: { file: sourceFile, caseId: 'HASH-034' },
  }),
  singleExpressionCase({
    id: '028-hash-context-execution-name',
    title: 'hashes AWS execution name from context',
    group,
    tags: ['context', 'matcher'],
    expression: "States.Hash($$.Execution.Name, 'SHA-256')",
    input: {},
    expected: result => expectHashShape(result, 64),
    notes: 'Exact digest depends on the generated execution name, so this uses a format matcher.',
    source: { file: sourceFile, caseId: 'HASH-035' },
  }),
  singleExpressionCase({
    id: '029-reject-missing-data-path',
    title: 'rejects missing data path',
    group,
    tags: ['negative', 'invalid_runtime_input'],
    expression: "States.Hash($.missing, 'SHA-256')",
    input: {},
    expected: result => expectIntrinsicFailure(result, "could not be found in the input '{}'"),
    source: { file: sourceFile, caseId: 'HASH-036' },
  }),
  singleExpressionCase({
    id: '030-reject-missing-algorithm-path',
    title: 'rejects missing algorithm path',
    group,
    tags: ['negative', 'invalid_runtime_input'],
    expression: "States.Hash('hello', $.missingAlgo)",
    input: {},
    expected: result => expectIntrinsicFailure(result, "could not be found in the input '{}'"),
    source: { file: sourceFile, caseId: 'HASH-037' },
  }),
  singleExpressionCase({
    id: '031-hash-astral-unicode-character',
    title: 'hashes astral-plane Unicode character',
    group,
    tags: ['happy_path', 'unicode'],
    expression: "States.Hash('🚀', 'SHA-256')",
    input: {},
    expected: result =>
      expectHashValue(result, 'ebbc0b2870eb323f2b6cffa5c493ceef81ae7eb36afc73d4e0367301631daec5'),
    source: { file: sourceFile, caseId: 'HASH-038' },
  }),
];
