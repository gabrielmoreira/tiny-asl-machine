import { expect } from 'vitest';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.StringToJson';

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

export const statesStringToJsonCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-parse-object-json-from-input',
    title: 'parses object JSON text from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.StringToJson($.json)`,
    input: { json: '{"a":1}' },
    expected: expectOutput({ value: { a: 1 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-01',
    },
  }),
  singleExpressionCase({
    id: '002-parse-array-json-from-input',
    title: 'parses array JSON text from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.StringToJson($.json)`,
    input: { json: '[1,2,3]' },
    expected: expectOutput({ value: [1, 2, 3] }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-02',
    },
  }),
  singleExpressionCase({
    id: '003-parse-string-primitive',
    title: 'parses a JSON string primitive',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: '"hello"' },
    expected: expectOutput({ value: 'hello' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-03',
    },
  }),
  singleExpressionCase({
    id: '004-parse-numeric-json',
    title: 'parses numeric JSON text',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: '123' },
    expected: expectOutput({ value: 123 }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-04',
    },
  }),
  singleExpressionCase({
    id: '005-parse-boolean-json',
    title: 'parses boolean JSON text',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: 'true' },
    expected: expectOutput({ value: true }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-05',
    },
  }),
  singleExpressionCase({
    id: '006-parse-null-json',
    title: 'parses null JSON text',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: 'null' },
    expected: expectOutput({ value: null }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-06',
    },
  }),
  singleExpressionCase({
    id: '007-round-trip-via-json-to-string',
    title: 'round-trips through JsonToString',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.StringToJson(States.JsonToString($.obj))`,
    input: { obj: { a: 1, nested: { ok: true } } },
    expected: expectOutput({ value: { a: 1, nested: { ok: true } } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-07',
    },
  }),
  multiExpressionCase({
    id: '008-parse-json-from-execution-context',
    title: 'parses JSON text sourced from execution input context',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: `States.StringToJson($$.Execution.Input.payload)`,
      raw: `$$.Execution.Input.payload`,
    },
    input: { payload: '{"from":"execution-input"}' },
    expected: expectOutput({
      value: { from: 'execution-input' },
      raw: '{"from":"execution-input"}',
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-08',
    },
  }),
  singleExpressionCase({
    id: '009-parse-json-with-surrounding-whitespace',
    title: 'parses surrounding whitespace around a JSON document',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: ' {"a":1} ' },
    expected: expectOutput({ value: { a: 1 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-22',
    },
  }),
  singleExpressionCase({
    id: '010-parse-apostrophes-in-string-values',
    title: 'parses escaped apostrophes inside JSON string values',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: '{"a":"it\'s"}' },
    expected: expectOutput({ value: { a: "it's" } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-23',
    },
  }),
  singleExpressionCase({
    id: '011-reject-malformed-object-json',
    title: 'rejects malformed object JSON syntax',
    group,
    tags: ['negative', 'malformed_input'],
    expression: `States.StringToJson($.json)`,
    input: { json: '{bad json}' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-09',
    },
  }),
  singleExpressionCase({
    id: '012-reject-truncated-object-json',
    title: 'rejects truncated object JSON text',
    group,
    tags: ['negative', 'malformed_input'],
    expression: `States.StringToJson($.json)`,
    input: { json: '{"a":1' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-10',
    },
  }),
  singleExpressionCase({
    id: '013-reject-empty-string-parse',
    title: 'rejects an empty string parse attempt',
    group,
    tags: ['negative', 'malformed_input', 'boundary'],
    expression: `States.StringToJson($.json)`,
    input: { json: '' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS currently returns { value: null } for States.StringToJson on an empty string input, while the local runtime raises a runtime error; keep this stricter malformed-input characterization local-only until parity is addressed.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-11',
    },
  }),
  singleExpressionCase({
    id: '014-reject-undefined-identifier-text',
    title: 'rejects undefined identifier text',
    group,
    tags: ['negative', 'malformed_input'],
    expression: `States.StringToJson($.json)`,
    input: { json: 'undefined' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-12',
    },
  }),
  singleExpressionCase({
    id: '015-reject-number-input',
    title: 'rejects number input instead of a string',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringToJson($.json)`,
    input: { json: 123 },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-13',
    },
  }),
  singleExpressionCase({
    id: '016-reject-object-input',
    title: 'rejects object input instead of a string',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringToJson($.json)`,
    input: { json: { a: 1 } },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-16',
    },
  }),
  singleExpressionCase({
    id: '017-reject-array-input',
    title: 'rejects array input instead of a string',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.StringToJson($.json)`,
    input: { json: [1, 2] },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-17',
    },
  }),
  singleExpressionCase({
    id: '018-reject-zero-argument-invocation',
    title: 'rejects zero-argument invocation',
    group,
    tags: ['negative', 'arity'],
    expression: `States.StringToJson()`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-18',
    },
  }),
  singleExpressionCase({
    id: '019-reject-extra-arguments',
    title: 'rejects extra arguments beyond arity',
    group,
    tags: ['negative', 'arity'],
    expression: `States.StringToJson($.a, $.b)`,
    input: { a: '{"x":1}', b: 'unused' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-19',
    },
  }),
  singleExpressionCase({
    id: '020-reject-missing-path-input',
    title: 'rejects missing path input',
    group,
    tags: ['negative', 'runtime_input', 'context'],
    expression: `States.StringToJson($.missing)`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.StringToJson.ts',
      caseId: 'STJ-24',
    },
  }),
];
