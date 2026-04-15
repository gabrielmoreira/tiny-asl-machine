import { expect } from 'vitest';
import { matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.IsString';
const source = {
  file: 'src/choices/operators.spec.ts',
  notes:
    'Derived from legacy IsString operator coverage and Choice-state default/no-default behavior tests.',
};

function expectSelected(selected: string) {
  return (result: TestResult) => {
    expect(result).toStrictEqual({ output: { selected } });
  };
}

function expectError(error: string) {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const choiceIsStringCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-simple-string-match',
    title: 'matches a simple string value',
    group,
    tags: ['happy_path', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: 'hello' },
    expected: expectSelected('matched'),
    source,
  }),
  matchChoiceCase({
    id: '002-empty-string-match',
    title: 'matches an empty string value',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: '' },
    expected: expectSelected('matched'),
    source,
  }),
  matchChoiceCase({
    id: '003-timestamp-like-string-match',
    title: 'matches a timestamp-looking value because it is still a string',
    group,
    tags: ['happy_path', 'negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: '2025-01-01T00:00:00Z' },
    expected: expectSelected('matched'),
    notes: 'Defensive case to ensure IsString does not require a non-timestamp string shape.',
    source,
  }),
  matchChoiceCase({
    id: '004-number-default',
    title: 'routes to Default for a numeric value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: 42 },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '005-boolean-default',
    title: 'routes to Default for a boolean value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: false },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '006-object-default',
    title: 'routes to Default for an object value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: { text: 'hello' } },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '007-null-default',
    title: 'routes to Default for a null value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: true } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '008-missing-path-default',
    title: 'routes to Default when the variable path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsString: true } }],
    noMatchKey: 'default',
    input: { value: 'present but ignored' },
    expected: expectSelected('default'),
    notes:
      'Current local runtime treats a missing IsString path as a non-match and falls through to Default, while AWS reports a runtime error.',
    awsExecutable: false,
    skipReason:
      'Current local runtime defaults this missing-path IsString case; AWS treats the same missing variable path as a runtime error even when Default is present.',
    source,
  }),
  matchChoiceCase({
    id: '009-missing-path-no-default',
    title: 'fails with States.Runtime when the variable path is missing and there is no Default',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsString: true } }],
    input: { value: 'present but ignored' },
    expected: expectError('States.Runtime'),
    notes:
      'AWS treats missing IsString variable paths as invalid choice paths rather than a no-choice-matched condition.',
    source,
  }),
  matchChoiceCase({
    id: '010-false-non-string-match',
    title: 'matches a non-string value when IsString is false',
    group,
    tags: ['happy_path', 'negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: false } }],
    input: { value: 7 },
    expected: expectSelected('matched'),
    notes: 'Verifies the explicit false branch of the type-test operator.',
    source,
  }),
  matchChoiceCase({
    id: '011-false-string-runtime',
    title: 'fails when IsString is false but the runtime value is a string',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsString: false } }],
    input: { value: 'still a string' },
    expected: expectError('States.Runtime'),
    source,
  }),
];
