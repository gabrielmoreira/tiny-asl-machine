import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.IsPresent';
const sourceFile = 'src/choices/operators.spec.ts';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectNoChoiceMatched(): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const choiceIsPresentCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-present-path-match',
    title: 'matches when the variable path exists and IsPresent is true',
    group,
    tags: ['happy_path', 'presence_check'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsPresent: true } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '002-missing-path-default',
    title: 'returns Default when the variable path is missing and IsPresent is true',
    group,
    tags: ['missing_path', 'negative', 'default_behavior'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsPresent: true } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('default'),
    source: {
      file: sourceFile,
      notes: 'Derived from the missing-path IsPresent=true example.',
    },
  }),
  matchChoiceCase({
    id: '003-missing-path-inverse-match',
    title: 'matches when the variable path is missing and IsPresent is false',
    group,
    tags: ['missing_path', 'happy_path', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsPresent: false } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Derived from the missing-path IsPresent=false example.',
    },
  }),
  matchChoiceCase({
    id: '004-present-path-inverse-default',
    title: 'returns Default when the variable path exists and IsPresent is false',
    group,
    tags: ['negative', 'default_behavior', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsPresent: false } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '005-null-is-present',
    title: 'treats explicit null as present when IsPresent is true',
    group,
    tags: ['happy_path', 'null_handling', 'presence_check'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsPresent: true } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('matched'),
    notes: 'Presence is about path existence rather than non-null value.',
  }),
  matchChoiceCase({
    id: '006-null-inverse-default',
    title: 'treats explicit null as present when IsPresent is false',
    group,
    tags: ['negative', 'null_handling', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsPresent: false } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '007-nested-path-match',
    title: 'matches nested existing paths when IsPresent is true',
    group,
    tags: ['happy_path', 'nested', 'presence_check'],
    rules: [{ key: 'matched', rule: { Variable: '$.detail.result.code', IsPresent: true } }],
    noMatchKey: 'default',
    input: {
      detail: {
        result: {
          code: 'OK',
        },
      },
    },
    expected: expectSelected('matched'),
  }),
  customDefinitionCase({
    id: '008-no-default-missing-path',
    title: 'fails with States.NoChoiceMatched when no rule matches and no Default is present',
    group,
    tags: ['negative', 'no_default', 'error_behavior'],
    definition: buildChoiceDefinition(
      { Variable: '$.missing', IsPresent: true },
      { withDefault: false }
    ),
    input: { value: 1 },
    expected: expectNoChoiceMatched(),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Uses the standard Choice no-default failure behavior for this operator-specific catalog.',
    },
  }),
];
