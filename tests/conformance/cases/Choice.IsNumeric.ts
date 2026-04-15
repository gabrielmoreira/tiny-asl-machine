import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.IsNumeric';
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

export const choiceIsNumericCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-integer-match',
    title: 'matches integer values when IsNumeric is true',
    group,
    tags: ['happy_path', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: 42 },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '002-decimal-match',
    title: 'matches decimal values when IsNumeric is true',
    group,
    tags: ['happy_path', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: 3.14 },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Derived from the IsNumeric operator example.',
    },
  }),
  matchChoiceCase({
    id: '003-numeric-string-default',
    title: 'returns Default for numeric strings when IsNumeric is true',
    group,
    tags: ['negative', 'type_validation', 'default_behavior'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: '42' },
    expected: expectSelected('default'),
    notes: 'Confirms that stringified numbers are not treated as numeric values.',
  }),
  matchChoiceCase({
    id: '004-object-default',
    title: 'returns Default for objects when IsNumeric is true',
    group,
    tags: ['negative', 'type_validation', 'default_behavior'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: { amount: 42 } },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '005-null-default',
    title: 'returns Default for null when IsNumeric is true',
    group,
    tags: ['negative', 'null_handling', 'default_behavior'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '006-inverse-string-match',
    title: 'matches non-numeric strings when IsNumeric is false',
    group,
    tags: ['happy_path', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: false } }],
    noMatchKey: 'default',
    input: { value: 'not-a-number' },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '007-inverse-number-default',
    title: 'returns Default for numeric values when IsNumeric is false',
    group,
    tags: ['negative', 'default_behavior', 'inverse_case'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsNumeric: false } }],
    noMatchKey: 'default',
    input: { value: -7 },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '008-missing-path-inverse-match',
    title: 'matches when the path is missing and IsNumeric is false',
    group,
    tags: ['missing_path', 'inverse_case', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsNumeric: false } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('matched'),
    notes:
      'Current local runtime treats a missing IsNumeric path as non-numeric for the inverse branch, while AWS reports a runtime error before evaluating it.',
    awsExecutable: false,
    skipReason:
      'Current local runtime matches this missing-path IsNumeric=false case; AWS treats the same missing variable path as a runtime error before evaluating the inverse branch.',
  }),
  matchChoiceCase({
    id: '009-missing-path-default',
    title: 'returns Default when the path is missing and IsNumeric is true',
    group,
    tags: ['missing_path', 'negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsNumeric: true } }],
    noMatchKey: 'default',
    input: { value: 1 },
    expected: expectSelected('default'),
    notes:
      'Current local runtime treats a missing IsNumeric path as a non-match and falls through to Default, while AWS reports a runtime error.',
    awsExecutable: false,
    skipReason:
      'Current local runtime defaults this missing-path IsNumeric=true case; AWS treats the same missing variable path as a runtime error even when Default is present.',
  }),
  customDefinitionCase({
    id: '010-no-default-string-input',
    title: 'fails with States.Runtime when no numeric rule matches and no Default is present',
    group,
    tags: ['negative', 'no_default', 'error_behavior'],
    definition: buildChoiceDefinition(
      { Variable: '$.value', IsNumeric: true },
      { withDefault: false }
    ),
    input: { value: '42' },
    expected: expectNoChoiceMatched(),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Uses the standard Choice no-default transition failure when no branch matches and no next state is available.',
    },
  }),
];
