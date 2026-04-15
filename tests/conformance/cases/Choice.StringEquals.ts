import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectNoChoiceMatched(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
  expect(result.cause).toContain('state does not point to a next state');
}

export const choiceStringEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-identical-match',
    title: 'matches identical strings',
    group: 'Choice.StringEquals',
    tags: ['happy_path'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', StringEquals: 'hello' } }],
    noMatchKey: 'defaulted',
    input: { value: 'hello' },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'StringEquals matches identical strings.',
    },
  }),
  matchChoiceCase({
    id: '002-different-default',
    title: 'takes the default branch for a different string value',
    group: 'Choice.StringEquals',
    tags: ['negative'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', StringEquals: 'hello' } }],
    noMatchKey: 'defaulted',
    input: { value: 'world' },
    expected: expectSelected('defaulted'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'StringEquals returns undefined for a different string.',
    },
  }),
  matchChoiceCase({
    id: '003-missing-variable-runtime',
    title: 'fails with States.Runtime when the selected variable is missing',
    group: 'Choice.StringEquals',
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', StringEquals: 'hello' } }],
    noMatchKey: 'defaulted',
    input: {},
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.value'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  matchChoiceCase({
    id: '004-number-default',
    title: 'does not match when the runtime value is numeric instead of string',
    group: 'Choice.StringEquals',
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', StringEquals: '1' } }],
    noMatchKey: 'defaulted',
    input: { value: 1 },
    expected: expectSelected('defaulted'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Derived from the mixed-type edge case where string and numeric comparisons must remain distinct.',
    },
  }),
  matchChoiceCase({
    id: '005-and-composition',
    title: 'participates in an And composition with another string rule',
    group: 'Choice.StringEquals',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'ready-in-region',
        rule: {
          And: [
            { Variable: '$.status', StringEquals: 'READY' },
            { Variable: '$.region', StringEquals: 'us-east-1' },
          ],
        },
      },
    ],
    noMatchKey: 'fallback',
    input: { status: 'READY', region: 'us-east-1' },
    expected: expectSelected('ready-in-region'),
  }),
  customDefinitionCase({
    id: '006-no-default-nonmatch',
    title: 'fails with States.Runtime when the string does not match and there is no default',
    group: 'Choice.StringEquals',
    tags: ['negative', 'no_default'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [{ Variable: '$.value', StringEquals: 'hello', Next: 'Matched' }],
        },
        Matched: {
          Type: 'Pass',
          Result: { branch: 'matched' },
          End: true,
        },
      },
    },
    input: { value: 'world' },
    expected: result => expectNoChoiceMatched(result),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state without Default throws when no rule matches.',
    },
  }),
  matchChoiceCase({
    id: '007-boolean-stringish-default',
    title: 'does not match a boolean runtime value even when the rule looks string-equivalent',
    group: 'Choice.StringEquals',
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', StringEquals: 'true' } }],
    noMatchKey: 'defaulted',
    input: { value: true },
    expected: expectSelected('defaulted'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Boolean runtime values must not satisfy StringEquals via implicit string coercion.',
    },
  }),
];
