import { expect } from 'vite-plus/test';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.JsonToString';

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

export const statesJsonToStringCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-serialize-object-from-input-path',
    title: 'serializes an object from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.JsonToString($.obj)`,
    input: { obj: { a: 1 } },
    expected: expectOutput({ value: '{"a":1}' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-01',
    },
  }),
  singleExpressionCase({
    id: '002-serialize-array-from-input-path',
    title: 'serializes an array from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.JsonToString($.arr)`,
    input: { arr: [1, 2, 3] },
    expected: expectOutput({ value: '[1,2,3]' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-02',
    },
  }),
  singleExpressionCase({
    id: '003-serialize-string-primitive',
    title: 'serializes a string primitive',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.str)`,
    input: { str: 'hello' },
    expected: expectOutput({ value: '"hello"' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-03',
    },
  }),
  singleExpressionCase({
    id: '004-serialize-number-primitive',
    title: 'serializes a number primitive',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.num)`,
    input: { num: 123 },
    expected: expectOutput({ value: '123' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-04',
    },
  }),
  singleExpressionCase({
    id: '005-serialize-boolean-primitive',
    title: 'serializes a boolean primitive',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.bool)`,
    input: { bool: false },
    expected: expectOutput({ value: 'false' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-05',
    },
  }),
  singleExpressionCase({
    id: '006-serialize-null-primitive',
    title: 'serializes a null primitive',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.val)`,
    input: { val: null },
    expected: expectOutput({ value: 'null' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-06',
    },
  }),
  singleExpressionCase({
    id: '007-round-trip-through-string-to-json',
    title: 'round-trips through StringToJson',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.JsonToString(States.StringToJson($.json))`,
    input: { json: '{"a":1}' },
    expected: expectOutput({ value: '{"a":1}' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-07',
    },
  }),
  multiExpressionCase({
    id: '008-serialize-context-sourced-value',
    title: 'serializes a value sourced from execution input context',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: `States.JsonToString($$.Execution.Input.payload)`,
      raw: `$$.Execution.Input.payload`,
    },
    input: { payload: { from: 'execution-input', n: 1 } },
    expected: expectOutput({
      value: '{"from":"execution-input","n":1}',
      raw: { from: 'execution-input', n: 1 },
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-08',
    },
  }),
  singleExpressionCase({
    id: '009-serialize-empty-object',
    title: 'serializes an empty object',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.obj)`,
    input: { obj: {} },
    expected: expectOutput({ value: '{}' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-09',
    },
  }),
  singleExpressionCase({
    id: '010-serialize-empty-array',
    title: 'serializes an empty array',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.arr)`,
    input: { arr: [] },
    expected: expectOutput({ value: '[]' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-10',
    },
  }),
  singleExpressionCase({
    id: '011-serialize-nested-array-result',
    title: 'serializes a nested Array intrinsic result',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.JsonToString(States.Array($.a, $.b))`,
    input: { a: 1, b: 2 },
    expected: expectOutput({ value: '[1,2]' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-14',
    },
  }),
  singleExpressionCase({
    id: '012-serialize-nested-mixed-structure',
    title: 'serializes a nested mixed structure',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.obj)`,
    input: { obj: { nested: { a: 1 }, arr: [true, null] } },
    expected: expectOutput({ value: '{"nested":{"a":1},"arr":[true,null]}' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-16',
    },
  }),
  singleExpressionCase({
    id: '013-reject-zero-argument-invocation',
    title: 'rejects zero-argument invocation',
    group,
    tags: ['negative', 'arity'],
    expression: `States.JsonToString()`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-11',
    },
  }),
  singleExpressionCase({
    id: '014-reject-extra-arguments',
    title: 'rejects extra arguments beyond arity',
    group,
    tags: ['negative', 'arity'],
    expression: `States.JsonToString($.a, $.b)`,
    input: { a: { x: 1 }, b: 'unused' },
    expected: result => expectIntrinsicFailure(result),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-12',
    },
  }),
  singleExpressionCase({
    id: '015-reject-missing-path-value',
    title: 'rejects a missing path value',
    group,
    tags: ['negative', 'runtime_input'],
    expression: `States.JsonToString($.missing)`,
    input: {},
    expected: expectOutput({ value: undefined }),
    awsExecutable: false,
    skipReason:
      'AWS raises a States.Runtime error when the JsonPath argument is missing, while the local runtime currently materializes an undefined field; keep this as a local-only characterization until shared missing-path parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-13',
    },
  }),
  singleExpressionCase({
    id: '016-serialize-literal-string-argument',
    title: 'serializes a literal string argument that is not a path or intrinsic result',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString('x')`,
    input: {},
    expected: expectOutput({ value: '"x"' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-17',
    },
  }),
  singleExpressionCase({
    id: '017-serialize-literal-null-argument',
    title: 'serializes a literal null argument that is not a path or intrinsic result',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString(null)`,
    input: {},
    expected: expectOutput({ value: 'null' }),
    awsExecutable: false,
    skipReason:
      'AWS/local parity is unresolved for literal null arguments in States.JsonToString; keep this as an existing local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonToString.ts',
      caseId: 'JTS-18',
    },
  }),
  singleExpressionCase({
    id: '018-serialize-mixed-probe-array',
    title: 'serializes a mixed-value probe array',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.probe)`,
    input: { probe: [null, '', ' ', 0, 1, true, false, [0, 1, false]] },
    expected: expectOutput({ value: '[null,""," ",0,1,true,false,[0,1,false]]' }),
    source: {
      file: 'tests/conformance/cases/States.JsonToString.ts',
      notes:
        'Covers null, empty-string, whitespace, booleans, numbers, and nested arrays in one readable probe.',
    },
  }),
  singleExpressionCase({
    id: '019-serialize-boundary-number-array',
    title: 'serializes negative, fractional, and huge boundary numbers',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.nums)`,
    input: { nums: [-1, 3.5, -9007199254740991, 9007199254740991] },
    expected: expectOutput({ value: '[-1,3.5,-9007199254740991,9007199254740991]' }),
    source: {
      file: 'tests/conformance/cases/States.JsonToString.ts',
      notes: 'Makes numeric edge coverage explicit for serialization-sensitive behavior.',
    },
  }),
  singleExpressionCase({
    id: '020-serialize-mixed-type-pairs-object',
    title: 'serializes a readable object of mixed-type pairings',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonToString($.obj)`,
    input: {
      obj: {
        boolNumber: [true, 0],
        boolString: [false, 'false'],
        stringBool: ['true', true],
        stringNumber: ['42', 42],
        stringDate: ['1970-01-01T00:00:00Z', '2024-02-29T12:34:56.789Z'],
        stringArray: ['items', [0, 1, false]],
        numberArray: [7, [0, 1, false]],
      },
    },
    expected: expectOutput({
      value:
        '{"boolNumber":[true,0],"boolString":[false,"false"],"stringBool":["true",true],"stringNumber":["42",42],"stringDate":["1970-01-01T00:00:00Z","2024-02-29T12:34:56.789Z"],"stringArray":["items",[0,1,false]],"numberArray":[7,[0,1,false]]}',
    }),
    source: {
      file: 'tests/conformance/cases/States.JsonToString.ts',
      notes:
        'Maps requested coercion-sensitive mixed-type combinations into a single readable serialization fixture.',
    },
  }),
];
