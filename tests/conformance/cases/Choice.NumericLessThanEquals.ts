import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.NumericLessThanEquals';
const sourceFile = 'src/choices/operators.spec.ts';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected = (selected: string) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
};

function buildNumericLessThanEqualsDefinition(ruleValue: number, withDefault = true) {
  return buildChoiceDefinition(
    {
      Variable: '$.value',
      NumericLessThanEquals: ruleValue,
    },
    {
      withDefault,
      matchedResult: { selected: matchedKey },
      defaultResult: { selected: defaultKey },
      matchedStateName: 'Matched',
      defaultStateName: 'Defaulted',
      checkStateName: 'CheckValue',
    }
  );
}

export const choiceNumericLessThanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-equal-match',
    title: 'matches when the input equals the rule value',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      caseId: 'NumericLessThanEquals-matches-when-the-input-number-equals-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '002-smaller-match',
    title: 'matches when the input is smaller than the rule value',
    group,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 9 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Complements the legacy equality coverage with the strictly-less branch.',
    },
  }),
  matchChoiceCase({
    id: '003-larger-default',
    title: 'takes the default branch when the input is larger than the rule value',
    group,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 11 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId:
        'NumericLessThanEquals-returns-undefined-when-the-input-number-is-larger-than-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '004-negative-equal',
    title: 'matches negative numbers that equal the threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: -2 } }],
    noMatchKey: defaultKey,
    input: { value: -2 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends inclusive comparison coverage to negative values.',
    },
  }),
  matchChoiceCase({
    id: '005-decimal-below',
    title: 'matches decimal numbers below the threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10.5 } }],
    noMatchKey: defaultKey,
    input: { value: 10.25 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends inclusive comparison coverage to decimal values.',
    },
  }),
  matchChoiceCase({
    id: '006-string-nonmatch',
    title: 'does not match a numeric string runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10 } }],
    noMatchKey: defaultKey,
    input: { value: '10' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'EdgeCases-type-mismatch-does-not-satisfy-choice-rule',
      notes: 'String input should not satisfy NumericLessThanEquals.',
    },
  }),
  matchChoiceCase({
    id: '007-array-nonmatch',
    title: 'does not match an array runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThanEquals: 10 } }],
    noMatchKey: defaultKey,
    input: { value: [9] },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Array input should not satisfy NumericLessThanEquals.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-nonmatch',
    title: 'fails with States.NoChoiceMatched when no branch matches and there is no default',
    group,
    tags: ['negative'],
    definition: buildNumericLessThanEqualsDefinition(10, false),
    input: { value: 11 },
    expected: result => {
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toContain('state does not point to a next state');
    },
    source: {
      file: sourceFile,
      caseId: 'ChoiceState-no-default-no-match',
    },
  }),
];
