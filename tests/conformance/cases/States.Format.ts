import { expect } from 'vite-plus/test';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.Format';

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

export const statesFormatCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-format-single-placeholder-from-input-path',
    title: 'formats a single placeholder from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.Format('Hello {}', $.name)`,
    input: { name: 'Ada' },
    expected: expectOutput({ value: 'Hello Ada' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-01',
    },
  }),
  singleExpressionCase({
    id: '002-format-mixed-scalar-placeholders',
    title: 'formats multiple placeholders with mixed scalar arguments',
    group,
    tags: ['happy_path'],
    expression: `States.Format('{} {} {}', $.a, $.b, $.c)`,
    input: { a: 'x', b: 2, c: true },
    expected: expectOutput({ value: 'x 2 true' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-02',
    },
  }),
  singleExpressionCase({
    id: '003-preserve-escaped-quotes-around-placeholders',
    title: 'preserves escaped quotes around placeholders',
    group,
    tags: ['happy_path', 'boundary'],
    expression: "States.Format('Name: \\'{}\\', Surname: \"{}\"', $.name, $.surname)",
    input: { name: 'Gabriel', surname: 'Moreira' },
    expected: expectOutput({ value: `Name: 'Gabriel', Surname: "Moreira"` }),
    source: {
      file: 'src/utils/selectPath.spec.ts',
      notes: 'Derived from the existing black-box intrinsic formatting scenario.',
    },
  }),
  singleExpressionCase({
    id: '004-keep-template-without-placeholders',
    title: 'returns the template unchanged when it has no placeholders',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.Format('no placeholders')`,
    input: {},
    expected: expectOutput({ value: 'no placeholders' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-05',
    },
  }),
  singleExpressionCase({
    id: '005-accept-template-from-input-path',
    title: 'accepts the template from an input path',
    group,
    tags: ['happy_path'],
    expression: `States.Format($.template, $.name)`,
    input: { template: 'Hello {}', name: 'Ada' },
    expected: expectOutput({ value: 'Hello Ada' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-06',
    },
  }),
  multiExpressionCase({
    id: '006-format-with-execution-input-context',
    title: 'formats using both input data and execution input context',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      value: `States.Format('{}:{}', $.name, $$.Execution.Input.suffix)`,
      suffixFromContext: `$$.Execution.Input.suffix`,
    },
    input: { name: 'job', suffix: 'run' },
    expected: expectOutput({
      value: 'job:run',
      suffixFromContext: 'run',
    }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-23',
    },
  }),
  singleExpressionCase({
    id: '007-format-nested-json-to-string-result',
    title: 'formats a nested JsonToString result',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.Format('arn:{}:{}', $.svc, States.JsonToString($.obj))`,
    input: { svc: 'lambda', obj: { k: 1 } },
    expected: expectOutput({ value: 'arn:lambda:{"k":1}' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-03',
    },
  }),
  singleExpressionCase({
    id: '008-preserve-template-whitespace',
    title: 'preserves leading and trailing whitespace in the template',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.Format('  {}  ', $.a)`,
    input: { a: 'x' },
    expected: expectOutput({ value: '  x  ' }),
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-19',
    },
  }),
  singleExpressionCase({
    id: '009-reject-too-few-replacements',
    title: 'rejects too few replacement arguments for the placeholder count',
    group,
    tags: ['negative', 'arity'],
    expression: `States.Format('{} {}', $.a)`,
    input: { a: 'x' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for this malformed States.Format arity case; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-14',
    },
  }),
  singleExpressionCase({
    id: '010-reject-too-many-replacements',
    title: 'rejects too many replacement arguments for the placeholder count',
    group,
    tags: ['negative', 'arity'],
    expression: `States.Format('{}', $.a, $.b)`,
    input: { a: 'x', b: 'y' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for this malformed States.Format arity case; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-15',
    },
  }),
  singleExpressionCase({
    id: '011-reject-non-string-template',
    title: 'rejects a non-string template value',
    group,
    tags: ['negative', 'type_validation'],
    expression: `States.Format($.template, $.name)`,
    input: { template: 123, name: 'Ada' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS currently classifies this non-string template input differently from the local runtime; keep this as a local characterization until shared States.Format argument-validation parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-07',
    },
  }),
  singleExpressionCase({
    id: '012-reject-unmatched-opening-brace',
    title: 'rejects an unmatched opening brace in the template',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: `States.Format('Hello {', $.a)`,
    input: { a: 'x' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for this malformed States.Format template case; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-17',
    },
  }),
  singleExpressionCase({
    id: '013-reject-doubled-brace-ambiguity',
    title: 'rejects doubled brace ambiguity in the template',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: `States.Format('Hello {{}}', $.a)`,
    input: { a: 'x' },
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for this malformed States.Format template case; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-18',
    },
  }),
  singleExpressionCase({
    id: '014-reject-lone-closing-brace',
    title: 'rejects a lone closing brace literal',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: `States.Format('}')`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    awsExecutable: false,
    skipReason:
      'AWS/local parity currently diverges only in negative error-cause text for this malformed States.Format template case; keep this as a local characterization until shared intrinsic parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-21',
    },
  }),
  singleExpressionCase({
    id: '015-format-scalar-from-string-to-json',
    title: 'formats a scalar produced by nested StringToJson',
    group,
    tags: ['happy_path', 'nested'],
    expression: `States.Format('{}', States.StringToJson($.json))`,
    input: { json: '"x"' },
    expected: expectOutput({ value: 'x' }),
    awsExecutable: false,
    skipReason:
      'AWS stringifies the nested StringToJson scalar result differently from the local runtime for States.Format; keep this scalar-coercion characterization local-only until parity is finalized.',
    source: {
      file: 'tests/support/conformance/intrinsicCases/States.Format.ts',
      caseId: 'FMT-24',
    },
  }),
  singleExpressionCase({
    id: '016-format-null-boolean-and-boundary-numbers',
    title: 'formats null, boolean, and numeric boundary values',
    group,
    tags: ['happy_path', 'boundary'],
    expression: `States.Format('{}|{}|{}|{}|{}', $.nil, $.bool, $.negative, $.fractional, $.hugePositive)`,
    input: {
      nil: null,
      bool: false,
      negative: -1,
      fractional: 3.5,
      hugePositive: 9007199254740991,
    },
    expected: expectOutput({ value: '|false|-1|3.5|9007199254740991' }),
    awsExecutable: false,
    skipReason:
      'AWS renders null as the literal string "null" in this mixed-scalar States.Format case, while the local runtime currently emits an empty segment; keep this boundary coercion characterization local-only until parity is finalized.',
    source: {
      file: 'tests/conformance/cases/States.Format.ts',
      notes:
        'Extends mixed scalar coercion coverage with null/boolean and explicit numeric boundary values.',
    },
  }),
  singleExpressionCase({
    id: '017-format-serialized-mixed-probe-array',
    title: 'formats a serialized mixed-value probe array',
    group,
    tags: ['happy_path', 'nested', 'boundary'],
    expression: `States.Format('probe={}', States.JsonToString($.probe))`,
    input: { probe: [null, '', ' ', 0, 1, true, false, [0, 1, false]] },
    expected: expectOutput({ value: 'probe=[null,""," ",0,1,true,false,[0,1,false]]' }),
    source: {
      file: 'tests/conformance/cases/States.Format.ts',
      notes:
        'Covers string composition around a coercion-sensitive mixed-value serialization result.',
    },
  }),
  singleExpressionCase({
    id: '018-aws-observe-unmatched-opening-brace-message',
    title: 'observes AWS error shape for an unmatched opening brace in States.Format',
    group,
    tags: ['negative', 'parser_error', 'aws_observation'],
    expression: `States.Format('Hello {', $.a)`,
    input: { a: 'x' },
    expected: result => expectIntrinsicFailure(result),
    localExecutable: false,
    awsExecutable: true,
    notes:
      'AWS observation case for malformed string-template parsing. Snapshot wording is the behavioral reference.',
    source: {
      file: 'tests/conformance/cases/States.Format.ts',
      notes: 'AWS-only observation counterpart for the local malformed-template characterization.',
    },
  }),
  singleExpressionCase({
    id: '019-aws-observe-doubled-brace-ambiguity-message',
    title: 'observes AWS error shape for doubled brace ambiguity in States.Format',
    group,
    tags: ['negative', 'parser_error', 'aws_observation'],
    expression: `States.Format('Hello {{}}', $.a)`,
    input: { a: 'x' },
    expected: result => expectIntrinsicFailure(result),
    localExecutable: false,
    awsExecutable: true,
    notes:
      'AWS observation case for malformed string-template parsing. Snapshot wording is the behavioral reference.',
    source: {
      file: 'tests/conformance/cases/States.Format.ts',
      notes: 'AWS-only observation counterpart for the local malformed-template characterization.',
    },
  }),
  singleExpressionCase({
    id: '020-aws-observe-lone-closing-brace-message',
    title: 'observes AWS error shape for a lone closing brace literal in States.Format',
    group,
    tags: ['negative', 'parser_error', 'aws_observation'],
    expression: `States.Format('}')`,
    input: {},
    expected: result => expectIntrinsicFailure(result),
    localExecutable: false,
    awsExecutable: true,
    notes:
      'AWS observation case for malformed string-template parsing. Snapshot wording is the behavioral reference.',
    source: {
      file: 'tests/conformance/cases/States.Format.ts',
      notes: 'AWS-only observation counterpart for the local malformed-template characterization.',
    },
  }),
];
