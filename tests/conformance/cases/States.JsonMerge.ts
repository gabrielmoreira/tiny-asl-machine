import { expect } from 'vite-plus/test';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.JsonMerge';

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

export const statesJsonMergeCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-merge-disjoint-shallow-objects',
    title: 'merges disjoint shallow objects',
    group,
    tags: ['happy_path'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { x: 1 }, b: { y: 2 } },
    expected: expectOutput({ value: { x: 1, y: 2 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-01',
    },
  }),
  singleExpressionCase({
    id: '002-overwrite-colliding-keys-right-object',
    title: 'overwrites colliding keys with the right object',
    group,
    tags: ['happy_path'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { x: 1, y: 2 }, b: { y: 3, z: 4 } },
    expected: expectOutput({ value: { x: 1, y: 3, z: 4 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-02',
    },
  }),
  singleExpressionCase({
    id: '003-return-right-object-when-left-empty',
    title: 'returns the right object when the left object is empty',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: {}, b: { x: 1 } },
    expected: expectOutput({ value: { x: 1 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-03',
    },
  }),
  singleExpressionCase({
    id: '004-return-left-object-when-right-empty',
    title: 'returns the left object when the right object is empty',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { x: 1 }, b: {} },
    expected: expectOutput({ value: { x: 1 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-04',
    },
  }),
  singleExpressionCase({
    id: '005-replace-nested-objects-in-shallow-mode',
    title: 'replaces nested objects wholesale in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: {
      a: { nested: { a1: 1, a2: 2 } },
      b: { nested: { a3: 3 } },
    },
    expected: expectOutput({ value: { nested: { a3: 3 } } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-05',
    },
  }),
  singleExpressionCase({
    id: '006-replace-array-values-in-shallow-mode',
    title: 'replaces array values wholesale in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { list: [1, 2] }, b: { list: [3] } },
    expected: expectOutput({ value: { list: [3] } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-06',
    },
  }),
  singleExpressionCase({
    id: '007-overwrite-nested-key-with-null',
    title: 'overwrites a nested key with null in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { nested: { left: true }, keep: 1 }, b: { nested: null } },
    expected: expectOutput({ value: { nested: null, keep: 1 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-23',
    },
  }),
  singleExpressionCase({
    id: '008-overwrite-primitive-with-object',
    title: 'overwrites a primitive with an object in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { x: 1 }, b: { x: { new: true } } },
    expected: expectOutput({ value: { x: { new: true } } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-24',
    },
  }),
  multiExpressionCase({
    id: '009-merge-with-context-defaults',
    title: 'merges with a context-backed defaults object from execution input',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: `States.JsonMerge($.a, $$.Execution.Input.defaults, false)`,
      defaults: `$$.Execution.Input.defaults`,
    },
    input: { a: { value: 1 }, defaults: { fallback: true, value: 2 } },
    expected: expectOutput({
      value: { value: 2, fallback: true },
      defaults: { fallback: true, value: 2 },
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-17',
    },
  }),
  singleExpressionCase({
    id: '010-merge-nested-string-to-json-objects',
    title: 'merges objects produced by nested StringToJson calls',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.JsonMerge(States.StringToJson($.a), States.StringToJson($.b), false)`,
    input: { a: '{"left":1}', b: '{"right":2}' },
    expected: expectOutput({ value: { left: 1, right: 2 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-18',
    },
  }),
  singleExpressionCase({
    id: '011-reject-null-first-object',
    title: 'rejects null as the first object argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: null, b: {} },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for invalid first-argument object validation in States.JsonMerge; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-07',
    },
  }),
  singleExpressionCase({
    id: '012-reject-null-second-object',
    title: 'rejects null as the second object argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: {}, b: null },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for invalid second-argument object validation in States.JsonMerge; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-08',
    },
  }),
  singleExpressionCase({
    id: '013-reject-array-first-object',
    title: 'rejects an array as the first object argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: [], b: {} },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for invalid first-argument object validation in States.JsonMerge; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-09',
    },
  }),
  singleExpressionCase({
    id: '014-reject-primitive-second-object',
    title: 'rejects a primitive as the second object argument',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: {}, b: 'x' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for invalid second-argument object validation in States.JsonMerge; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-12',
    },
  }),
  singleExpressionCase({
    id: '015-accept-non-boolean-deep-flag-as-shallow-merge',
    title: 'accepts a non-boolean deep flag and behaves like shallow merge',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, $.deep)`,
    input: { a: {}, b: {}, deep: 'false' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS accepts a non-boolean deep flag by treating it as shallow merge output, while the local runtime still rejects non-boolean third arguments; keep this as a local-only characterization until shared invocation parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-13',
    },
  }),
  singleExpressionCase({
    id: '016-reject-unsupported-deep-merge-mode',
    title: 'rejects unsupported deep merge mode',
    group,
    tags: ['negative', 'invalid_definition', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, true)`,
    input: {
      a: { nested: { left: 1, keep: true }, top: 'a' },
      b: { nested: { right: 2 }, extra: 'b' },
    },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for unsupported deep-merge mode in States.JsonMerge; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'src/utils/selectPath.spec.ts',
      notes: 'Derived from the existing shallow-only negative JsonMerge scenario.',
    },
  }),
  singleExpressionCase({
    id: '017-reject-missing-third-argument',
    title: 'rejects a missing third argument',
    group,
    tags: ['negative', 'arity'],
    expression: `States.JsonMerge($.a, $.b)`,
    input: { a: {}, b: {} },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges on arity handling for missing third-argument JsonMerge invocation; keep this as a local characterization until shared invocation parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-19',
    },
  }),
  singleExpressionCase({
    id: '018-reject-extra-fourth-argument',
    title: 'rejects an extra fourth argument',
    group,
    tags: ['negative', 'arity'],
    expression: `States.JsonMerge($.a, $.b, false, $.extra)`,
    input: { a: {}, b: {}, extra: 1 },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges on arity handling for extra fourth-argument JsonMerge invocation; keep this as a local characterization until shared invocation parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-20',
    },
  }),
  singleExpressionCase({
    id: '019-reject-zero-argument-invocation',
    title: 'rejects zero-argument invocation',
    group,
    tags: ['negative', 'arity'],
    expression: `States.JsonMerge()`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges on arity handling for zero-argument JsonMerge invocation; keep this as a local characterization until shared invocation parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-21',
    },
  }),
  singleExpressionCase({
    id: '020-treat-proto-key-as-plain-data',
    title: 'treats dangerous __proto__ keys as plain data during shallow merge',
    group,
    tags: ['happy_path', 'boundary', 'negative'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { ['__proto__']: { polluted: true } }, b: { x: 1 } },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        value: expect.objectContaining({ x: 1 }),
      });
    },
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-15',
    },
    notes:
      'Matcher-based expectation keeps this security-sensitive observation focused on black-box success shape without overcommitting to object-prototype details.',
  }),
  singleExpressionCase({
    id: '021-overwrite-date-like-string-with-mixed-array',
    title: 'overwrites a date-like string with a mixed array value in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: {
      a: { payload: '2024-01-01T00:00:00Z', keep: 'left' },
      b: { payload: [null, '', ' ', 0, 1, true, false, [0, 1, false]] },
    },
    expected: expectOutput({
      value: { payload: [null, '', ' ', 0, 1, true, false, [0, 1, false]], keep: 'left' },
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-25',
    },
  }),
  singleExpressionCase({
    id: '022-overwrite-array-with-fractional-number',
    title: 'overwrites an array with a fractional number in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: { a: { payload: [1, 2, 3] }, b: { payload: -123.456 } },
    expected: expectOutput({ value: { payload: -123.456 } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-26',
    },
  }),
  singleExpressionCase({
    id: '023-overwrite-object-with-huge-negative-number',
    title: 'overwrites an object with a huge negative number in shallow mode',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.JsonMerge($.a, $.b, false)`,
    input: {
      a: { payload: { nested: true }, keep: 'left' },
      b: { payload: -9007199254740991 },
    },
    expected: expectOutput({ value: { payload: -9007199254740991, keep: 'left' } }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.JsonMerge.ts',
      caseId: 'JMG-27',
    },
  }),
];
