import { expect } from 'vitest';
import { multiExpressionCase, singleExpressionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.UUID';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.UUID.ts';
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setupLocalUuidSequence(...values: string[]) {
  let index = 0;

  return () => ({
    randomUUID: () => values[Math.min(index++, values.length - 1)],
  });
}
function expectAnyFailure(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBeTruthy();
  expect(result.cause).toEqual(expect.any(String));
}

function expectUuidValue(result: TestResult) {
  expect(result.error).toBeUndefined();
  expect(result.output).toMatchObject({ value: expect.any(String) });
  expect((result.output as { value: string }).value).toMatch(uuidV4Pattern);
}

export const statesUuidCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-generate-uuid-zero-arg',
    title: 'generates a UUID from the canonical zero-arg form',
    group,
    tags: ['happy_path'],
    expression: 'States.UUID()',
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('b6f1d3a7-e5c5-4507-a9f5-1592ff5c5245'),
    source: { file: sourceFile, caseId: 'UUID-001' },
  }),
  singleExpressionCase({
    id: '002-zero-arg-call-with-whitespace',
    title: 'tolerates whitespace inside the zero-arg call',
    group,
    tags: ['happy_path', 'parser'],
    expression: 'States.UUID( )',
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('0d553bbc-e4c4-492f-9196-382a58481210'),
    source: { file: sourceFile, caseId: 'UUID-002' },
  }),
  singleExpressionCase({
    id: '003-uuid-shape',
    title: 'matches the UUID 8-4-4-4-12 shape',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.UUID()',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(String) });
      const value = (result.output as { value: string }).value;
      const parts = value.split('-');
      expect(parts).toHaveLength(5);
      expect(parts.map(part => part.length)).toStrictEqual([8, 4, 4, 4, 12]);
    },
    setupLocal: setupLocalUuidSequence('fd972dc1-70e4-4833-ad75-bc4c46a7816b'),
    source: { file: sourceFile, caseId: 'UUID-003' },
  }),
  singleExpressionCase({
    id: '004-uuid-version-nibble-v4',
    title: 'exposes the UUID version nibble as v4',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.UUID()',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(String) });
      const value = (result.output as { value: string }).value;
      expect(value.split('-')[2][0]).toBe('4');
    },
    setupLocal: setupLocalUuidSequence('b7988ac4-b73b-4cd6-80e3-cc344bd41165'),
    source: { file: sourceFile, caseId: 'UUID-004' },
  }),
  singleExpressionCase({
    id: '005-uuid-variant-nibble-rfc4122',
    title: 'exposes the UUID variant nibble in RFC 4122 range',
    group,
    tags: ['happy_path', 'boundary'],
    expression: 'States.UUID()',
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(String) });
      const value = (result.output as { value: string }).value;
      expect(['8', '9', 'a', 'b']).toContain(value.split('-')[3][0]);
    },
    setupLocal: setupLocalUuidSequence('c3f20162-1157-425e-a746-a934ad4972d0'),
    source: { file: sourceFile, caseId: 'UUID-005' },
  }),
  multiExpressionCase({
    id: '006-repeated-uuid-calls',
    title: 'evaluates repeated UUID calls independently in one expression',
    group,
    tags: ['happy_path', 'nondeterministic'],
    expressions: {
      first: 'States.UUID()',
      second: 'States.UUID()',
    },
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({
        first: expect.any(String),
        second: expect.any(String),
      });
      const output = result.output as { first: string; second: string };
      expect(output.first).toMatch(uuidV4Pattern);
      expect(output.second).toMatch(uuidV4Pattern);
    },
    setupLocal: setupLocalUuidSequence(
      'ea4ef70f-1540-4f3c-bc90-05296e9ee4d4',
      '4ce072f1-a620-491b-a5ec-b75745c59685'
    ),
    notes:
      'Both sibling UUIDs must be valid independently; distinctness is not asserted to avoid nondeterministic false negatives.',
    source: { file: sourceFile, caseId: 'UUID-007' },
  }),
  singleExpressionCase({
    id: '007-uuid-inside-format',
    title: 'composes UUID inside States.Format',
    group,
    tags: ['happy_path', 'nested'],
    expression: "States.Format('{}', States.UUID())",
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({ value: expect.any(String) });
      expect((result.output as { value: string }).value).toMatch(uuidV4Pattern);
    },
    setupLocal: setupLocalUuidSequence('f80dfd80-5014-4487-bf72-ca769d2de713'),
    source: { file: sourceFile, caseId: 'UUID-008' },
  }),
  singleExpressionCase({
    id: '008-ignore-string-argument',
    title: 'still returns a UUID when given a string argument',
    group,
    tags: ['happy_path', 'arity', 'aws_observed'],
    expression: "States.UUID('x')",
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('63433d11-80b3-4ce9-9973-a7be3faa9753'),
    notes: 'AWS currently ignores the extra string argument and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-011' },
  }),
  singleExpressionCase({
    id: '009-ignore-path-argument',
    title: 'still returns a UUID when given a path argument',
    group,
    tags: ['happy_path', 'arity', 'aws_observed'],
    expression: 'States.UUID($.x)',
    input: { x: 'ignored' },
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('92405380-3f6f-48d5-a06b-56cdc09237f0'),
    notes: 'AWS currently ignores the extra path argument and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-012' },
  }),
  singleExpressionCase({
    id: '010-ignore-two-arguments',
    title: 'still returns a UUID when given two arguments',
    group,
    tags: ['happy_path', 'arity', 'aws_observed'],
    expression: 'States.UUID(1, 2)',
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('78d074fb-bb44-4210-a3bd-80dfb0fb5906'),
    notes: 'AWS currently ignores the extra arguments and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-013' },
  }),
  singleExpressionCase({
    id: '011-ignore-null-argument',
    title: 'still returns a UUID when given a null argument',
    group,
    tags: ['happy_path', 'arity', 'aws_observed'],
    expression: 'States.UUID(null)',
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('d3077249-b00d-4877-a60b-0ec0b6751b73'),
    notes: 'AWS currently ignores the null argument and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-014' },
  }),
  singleExpressionCase({
    id: '012-ignore-numeric-fake-seed',
    title: 'still returns a UUID when given a numeric fake seed argument',
    group,
    tags: ['happy_path', 'arity', 'seeded', 'aws_observed'],
    expression: 'States.UUID(123)',
    input: {},
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('ef243f80-05a1-4302-9517-b489c5d2bd0d'),
    notes: 'AWS currently ignores the fake seed argument and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-015' },
  }),
  singleExpressionCase({
    id: '013-ignore-path-fake-seed',
    title: 'still returns a UUID when given a path-based fake seed argument',
    group,
    tags: ['happy_path', 'arity', 'seeded', 'aws_observed'],
    expression: 'States.UUID($.seed)',
    input: { seed: 42 },
    expected: result => expectUuidValue(result),
    setupLocal: setupLocalUuidSequence('27311ea0-dc35-4163-91dd-d36672a3e8af'),
    notes: 'AWS currently ignores the fake seed argument and still returns a UUID.',
    source: { file: sourceFile, caseId: 'UUID-016' },
  }),
  multiExpressionCase({
    id: '014-uuid-beside-state-input',
    title: 'composes UUID beside ordinary state input',
    group,
    tags: ['happy_path', 'nested'],
    expressions: {
      prefix: '$.prefix',
      generated: 'States.UUID()',
    },
    input: { prefix: 'id' },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({
        prefix: 'id',
        generated: expect.any(String),
      });
      expect((result.output as { generated: string }).generated).toMatch(uuidV4Pattern);
    },
    setupLocal: setupLocalUuidSequence('a2e2cd9c-943a-4ac7-ab77-e176586dd8ae'),
    source: { file: sourceFile, caseId: 'UUID-017' },
  }),
  multiExpressionCase({
    id: '015-uuid-beside-context-value',
    title: 'composes UUID beside an execution context value',
    group,
    tags: ['happy_path', 'context'],
    expressions: {
      executionInputEcho: '$$.Execution.Input.prefix',
      generated: 'States.UUID()',
    },
    input: { prefix: 'ctx' },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({
        executionInputEcho: 'ctx',
        generated: expect.any(String),
      });
    },
    setupLocal: setupLocalUuidSequence('d1264be7-a67e-41f9-a724-1ef70854d5fa'),
    notes:
      'Uses deterministic execution input context rather than a live execution id so the case remains portable across runners.',
    source: { file: sourceFile, caseId: 'UUID-018' },
  }),
  singleExpressionCase({
    id: '016-reject-missing-closing-parenthesis',
    title: 'rejects a missing closing parenthesis',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: 'States.UUID(',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'UUID-019' },
  }),
  singleExpressionCase({
    id: '017-reject-stray-closing-parenthesis',
    title: 'rejects a stray closing parenthesis form',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: 'States.UUID)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'UUID-020' },
  }),
  singleExpressionCase({
    id: '018-reject-malformed-comma-placement',
    title: 'rejects malformed comma placement',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: 'States.UUID(,)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'UUID-021' },
  }),
  singleExpressionCase({
    id: '019-reject-trailing-characters',
    title: 'rejects trailing characters after a valid call',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: 'States.UUID() trailing',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'UUID-022' },
  }),
  singleExpressionCase({
    id: '020-reject-malformed-path-token',
    title: 'rejects a malformed path token argument',
    group,
    tags: ['negative', 'parser_error', 'malformed_input'],
    expression: 'States.UUID($',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'UUID-023' },
  }),
  multiExpressionCase({
    id: '021-uuid-with-state-and-context-fields',
    title: 'coexists with state and context reads in one evaluation',
    group,
    tags: ['happy_path', 'context', 'nested'],
    expressions: {
      label: '$.label',
      executionInputLabel: '$$.Execution.Input.label',
      generated: 'States.UUID()',
    },
    input: { label: 'prefix' },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.output).toMatchObject({
        label: 'prefix',
        executionInputLabel: 'prefix',
        generated: expect.any(String),
      });
      expect((result.output as { generated: string }).generated).toMatch(uuidV4Pattern);
    },
    setupLocal: setupLocalUuidSequence('e03f10b1-48b4-4d87-8a7b-c7c91ba31afc'),
    notes:
      'Adapted from the legacy combined state/context/UUID probe while keeping context assertions deterministic.',
    source: { file: sourceFile, caseId: 'UUID-025' },
  }),
];
