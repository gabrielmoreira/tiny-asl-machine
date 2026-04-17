import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const GROUP = 'Choice.StringGreaterThanEquals';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected = (selected: string) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
};

function expectError(error: string): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toContain('state does not point to a next state');
  };
}

export const choiceStringGreaterThanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-greater-match',
    title:
      'StringGreaterThanEquals selects the matched branch when the input sorts after the comparison string',
    group: GROUP,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'charlie' },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Extends StringGreaterThanEquals operator coverage into an executable Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-equal-match',
    title:
      'StringGreaterThanEquals selects the matched branch when the input equals the comparison string',
    group: GROUP,
    tags: ['boundary', 'happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'bravo' },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from the equal-value StringGreaterThanEquals scenario.',
    },
  }),
  matchChoiceCase({
    id: '003-lower-default',
    title:
      'StringGreaterThanEquals falls through to Default when the input sorts before the comparison string',
    group: GROUP,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'alpha' },
    expected: expectSelected(defaultKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from the non-match StringGreaterThanEquals operator coverage.',
    },
  }),
  matchChoiceCase({
    id: '004-empty-equal',
    title: 'StringGreaterThanEquals matches when both the input and comparison strings are empty',
    group: GROUP,
    tags: ['boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: '' } }],
    noMatchKey: defaultKey,
    input: { value: '' },
    expected: expectSelected(matchedKey),
  }),
  matchChoiceCase({
    id: '005-number-default',
    title:
      'StringGreaterThanEquals does not match a numeric runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(defaultKey),
    notes:
      'Wrong-type runtime coverage to capture AWS behavior for mixed numeric/string comparisons.',
  }),
  matchChoiceCase({
    id: '006-null-default',
    title:
      'StringGreaterThanEquals does not match a null runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringGreaterThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: null },
    expected: expectSelected(defaultKey),
  }),
  customDefinitionCase({
    id: '007-no-default-lower',
    title:
      'StringGreaterThanEquals fails with States.Runtime without Default when the input sorts before the comparison string',
    group: GROUP,
    tags: ['negative', 'invalid_runtime_input'],
    definition: buildChoiceDefinition(
      { Variable: '$.value', StringGreaterThanEquals: 'bravo' },
      { withDefault: false }
    ),
    input: { value: 'alpha' },
    expected: expectError('States.Runtime'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Derived from Choice-state transition failure behavior without a Default transition.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-null',
    title:
      'StringGreaterThanEquals fails with States.Runtime without Default for a non-matching null runtime value',
    group: GROUP,
    tags: ['negative', 'type_validation'],
    definition: buildChoiceDefinition(
      { Variable: '$.value', StringGreaterThanEquals: 'bravo' },
      { withDefault: false }
    ),
    input: { value: null },
    expected: expectError('States.Runtime'),
  }),
];
