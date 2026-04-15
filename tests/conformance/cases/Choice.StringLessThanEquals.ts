import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const GROUP = 'Choice.StringLessThanEquals';
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

function buildStringLessThanEqualsNoDefaultDefinition(comparedTo: string) {
  return buildChoiceDefinition(
    {
      Variable: '$.value',
      StringLessThanEquals: comparedTo,
    },
    {
      withDefault: false,
      matchedResult: { selected: matchedKey },
      matchedStateName: 'Matched',
      checkStateName: 'Compare',
    }
  );
}

export const choiceStringLessThanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-lower-match',
    title:
      'StringLessThanEquals selects the matched branch when the input sorts before the comparison string',
    group: GROUP,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'alpha' },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends StringLessThanEquals operator coverage into an executable Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-equal-match',
    title:
      'StringLessThanEquals selects the matched branch when the input equals the comparison string',
    group: GROUP,
    tags: ['boundary', 'happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'bravo' },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from the equal-value StringLessThanEquals scenario.',
    },
  }),
  matchChoiceCase({
    id: '003-greater-default',
    title:
      'StringLessThanEquals falls through to Default when the input sorts after the comparison string',
    group: GROUP,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 'charlie' },
    expected: expectSelected(defaultKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from the non-match StringLessThanEquals operator coverage.',
    },
  }),
  matchChoiceCase({
    id: '004-empty-equal',
    title: 'StringLessThanEquals matches when both the input and comparison strings are empty',
    group: GROUP,
    tags: ['boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: '' } }],
    noMatchKey: defaultKey,
    input: { value: '' },
    expected: expectSelected(matchedKey),
  }),
  matchChoiceCase({
    id: '005-number-default',
    title:
      'StringLessThanEquals does not match a numeric runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(defaultKey),
    notes:
      'Wrong-type runtime coverage to capture AWS behavior for mixed numeric/string comparisons.',
  }),
  matchChoiceCase({
    id: '006-array-default',
    title: 'StringLessThanEquals does not match an array runtime value against a string comparator',
    group: GROUP,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', StringLessThanEquals: 'bravo' } }],
    noMatchKey: defaultKey,
    input: { value: ['alpha'] },
    expected: expectSelected(defaultKey),
  }),
  customDefinitionCase({
    id: '007-no-default-greater',
    title:
      'StringLessThanEquals fails with States.Runtime without Default when the input sorts after the comparison string',
    group: GROUP,
    tags: ['negative', 'invalid_runtime_input'],
    definition: buildStringLessThanEqualsNoDefaultDefinition('bravo'),
    input: { value: 'charlie' },
    expected: expectError('States.Runtime'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Derived from Choice-state transition failure behavior without a Default transition.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-number',
    title:
      'StringLessThanEquals fails with States.Runtime without Default for a non-matching numeric runtime value',
    group: GROUP,
    tags: ['negative', 'type_validation'],
    definition: buildStringLessThanEqualsNoDefaultDefinition('bravo'),
    input: { value: 10 },
    expected: expectError('States.Runtime'),
  }),
];
