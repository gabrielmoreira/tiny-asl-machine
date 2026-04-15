import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.IsNull';
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
    expect(result.cause).toContain('state does not point to a next state');
  };
}

export const choiceIsNullCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-explicit-null-match',
    title: 'matches when the variable is explicitly null and IsNull is true',
    group,
    tags: ['happy_path', 'null_handling'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNull: true } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Derived from the IsNull operator example.',
    },
  }),
  matchChoiceCase({
    id: '002-nonnull-default',
    title: 'falls back to Default when the variable is not null and IsNull is true',
    group,
    tags: ['negative', 'default_behavior', 'null_handling'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNull: true } }],
    noMatchKey: 'default',
    input: { value: 'not-null' },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '003-nonnull-inverse-match',
    title: 'matches when the variable is not null and IsNull is false',
    group,
    tags: ['happy_path', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNull: false } }],
    noMatchKey: 'default',
    input: { value: 'not-null' },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Derived from the IsNull false-path example.',
    },
  }),
  matchChoiceCase({
    id: '004-null-inverse-default',
    title: 'falls back to Default when the variable is null and IsNull is false',
    group,
    tags: ['negative', 'default_behavior', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNull: false } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '005-missing-path-default',
    title: 'falls back to Default when the path is missing and IsNull is true',
    group,
    tags: ['missing_path', 'negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsNull: true } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('default'),
    notes:
      'Current local runtime treats a missing IsNull path as a non-match and falls through to Default, while AWS reports a runtime error.',
    awsExecutable: false,
    skipReason:
      'Current local runtime defaults this missing-path IsNull=true case; AWS treats the same missing variable path as a runtime error even when Default is present.',
  }),
  matchChoiceCase({
    id: '006-missing-path-inverse-match',
    title: 'matches when the path is missing and IsNull is false',
    group,
    tags: ['missing_path', 'inverse_case', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsNull: false } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('matched'),
    notes:
      'Current local runtime treats a missing IsNull path as null-like for the inverse branch, while AWS reports a runtime error before evaluating it.',
    awsExecutable: false,
    skipReason:
      'Current local runtime matches this missing-path IsNull=false case; AWS treats the same missing variable path as a runtime error before evaluating the inverse branch.',
  }),
  matchChoiceCase({
    id: '007-object-default',
    title: 'falls back to Default when the variable is an object and IsNull is true',
    group,
    tags: ['negative', 'type_validation', 'default_behavior'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNull: true } }],
    noMatchKey: 'default',
    input: { value: { nested: true } },
    expected: expectSelected('default'),
  }),
  customDefinitionCase({
    id: '008-no-default-nonmatch',
    title: 'fails with States.Runtime when no null rule matches and no Default is present',
    group,
    tags: ['negative', 'no_default', 'error_behavior'],
    definition: buildChoiceDefinition(
      { Variable: '$.value', IsNull: true },
      { withDefault: false }
    ),
    input: { value: 'not-null' },
    expected: expectNoChoiceMatched(),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Uses the standard Choice no-default transition failure when no branch matches and no next state is available.',
    },
  }),
];
