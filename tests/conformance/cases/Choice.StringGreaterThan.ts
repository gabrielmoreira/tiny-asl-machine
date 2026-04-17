import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const GROUP = 'Choice.StringGreaterThan';
const matchedKey = 'matched';
const defaultKey = 'default';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectError(error: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBe(error);
    expect(result.cause).toContain('state does not point to a next state');
    expect(result.output).toBeUndefined();
  };
}

function buildStringGreaterThanNoDefaultDefinition(comparedTo: string) {
  return buildChoiceDefinition(
    {
      Variable: '$.value',
      StringGreaterThan: comparedTo,
    },
    {
      withDefault: false,
      matchedResult: { selected: matchedKey },
      matchedStateName: 'Matched',
      checkStateName: 'Compare',
    }
  );
}

export const choiceStringGreaterThanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-greater-match',
    title:
      'StringGreaterThan selects the matched branch when the input sorts after the comparison string',
    group: GROUP,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'charlie' },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from StringGreaterThan operator coverage.',
    },
  }),
  matchChoiceCase({
    id: '002-equal-default',
    title: 'StringGreaterThan falls through to Default when the input equals the comparison string',
    group: GROUP,
    tags: ['boundary', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'bravo' },
    expected: expectSelected(defaultKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends the equal-value non-match scenario into an executable Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '003-lower-default',
    title:
      'StringGreaterThan falls through to Default when the input sorts before the comparison string',
    group: GROUP,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'alpha' },
    expected: expectSelected(defaultKey),
  }),
  matchChoiceCase({
    id: '004-empty-boundary',
    title: 'StringGreaterThan treats non-empty strings as sorting after the empty string',
    group: GROUP,
    tags: ['boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: '' } }],
    noMatchKey: defaultKey,
    input: { value: 'alpha' },
    expected: expectSelected(matchedKey),
  }),
  matchChoiceCase({
    id: '005-number-default',
    title: 'StringGreaterThan does not match a numeric runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(defaultKey),
    notes:
      'Wrong-type runtime coverage to capture AWS behavior for mixed numeric/string comparisons.',
  }),
  matchChoiceCase({
    id: '006-object-default',
    title: 'StringGreaterThan does not match an object runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThan: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: { label: 'charlie' } },
    expected: expectSelected(defaultKey),
  }),
  customDefinitionCase({
    id: '007-no-default-equal',
    title:
      'StringGreaterThan fails with States.Runtime without Default when the input equals the comparison string',
    group: GROUP,
    tags: ['negative', 'invalid_runtime_input'],
    definition: buildStringGreaterThanNoDefaultDefinition('bravo'),
    input: { value: 'bravo' },
    expected: expectError('States.Runtime'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Derived from Choice-state transition failure behavior without a Default transition.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-lower',
    title:
      'StringGreaterThan fails with States.Runtime without Default when the input sorts before the comparison string',
    group: GROUP,
    tags: ['negative'],
    definition: buildStringGreaterThanNoDefaultDefinition('bravo'),
    input: { value: 'alpha' },
    expected: expectError('States.Runtime'),
  }),
];
