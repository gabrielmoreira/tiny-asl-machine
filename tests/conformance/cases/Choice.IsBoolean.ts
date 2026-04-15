import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.IsBoolean';
const source = {
  file: 'src/choices/operators.spec.ts',
  notes:
    'Derived from legacy IsBoolean operator coverage and Choice-state default/no-default behavior tests.',
};

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectError(error: string): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const choiceIsBooleanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-true-boolean-match',
    title: 'matches a true boolean value',
    group,
    tags: ['happy_path', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: true },
    expected: expectSelected('matched'),
    source,
  }),
  matchChoiceCase({
    id: '002-false-boolean-match',
    title: 'matches a false boolean value',
    group,
    tags: ['happy_path', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: false },
    expected: expectSelected('matched'),
    source,
  }),
  matchChoiceCase({
    id: '003-string-true-default',
    title: 'routes to Default for a string literal true',
    group,
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: 'true' },
    expected: expectSelected('default'),
    notes: 'Defensive case for a lookalike value that should remain a string, not a boolean.',
    source,
  }),
  matchChoiceCase({
    id: '004-zero-default',
    title: 'routes to Default for a numeric zero',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: 0 },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '005-null-default',
    title: 'routes to Default for a null value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '006-array-default',
    title: 'routes to Default for an array value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: [true] },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '007-object-default',
    title: 'routes to Default for an object value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: { enabled: true } },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '008-missing-path-default',
    title: 'routes to Default when the variable path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.missing',
          IsBoolean: true,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: false },
    expected: expectSelected('default'),
    notes:
      'Current local runtime treats a missing IsBoolean path as a non-match and falls through to Default, while AWS reports a runtime error.',
    awsExecutable: false,
    skipReason:
      'Current local runtime defaults this missing-path IsBoolean case; AWS treats the same missing variable path as a runtime error even when Default is present.',
    source,
  }),
  customDefinitionCase({
    id: '009-no-default-missing-path',
    title: 'fails with States.Runtime when the path is missing and there is no Default',
    group,
    tags: ['negative', 'malformed_input'],
    definition: buildChoiceDefinition(
      { Variable: '$.missing', IsBoolean: true },
      { withDefault: false }
    ),
    input: { value: true },
    expected: expectError('States.Runtime'),
    source,
  }),
  matchChoiceCase({
    id: '010-inverse-nonboolean-match',
    title: 'matches a non-boolean value when IsBoolean is false',
    group,
    tags: ['happy_path', 'negative', 'type_validation'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.value',
          IsBoolean: false,
        },
      },
    ],
    noMatchKey: 'default',
    input: { value: 'nope' },
    expected: expectSelected('matched'),
    notes: 'Verifies the explicit false branch of the IsBoolean type test.',
    source,
  }),
  customDefinitionCase({
    id: '011-inverse-boolean-fail',
    title: 'fails when IsBoolean is false but the runtime value is boolean',
    group,
    tags: ['negative', 'type_validation'],
    definition: buildChoiceDefinition(
      { Variable: '$.value', IsBoolean: false },
      { withDefault: false }
    ),
    input: { value: false },
    expected: expectError('States.Runtime'),
    source,
  }),
];
