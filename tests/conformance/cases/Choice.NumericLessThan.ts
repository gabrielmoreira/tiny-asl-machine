import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.NumericLessThan';
const sourceFile = 'src/choices/operators.spec.ts';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected = (selected: string) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
};

function buildNumericLessThanDefinition(ruleValue: number, withDefault = true) {
  return buildChoiceDefinition(
    {
      Variable: '$.value',
      NumericLessThan: ruleValue,
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

export const choiceNumericLessThanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-smaller-match',
    title: 'matches when the input number is smaller than the rule value',
    group,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 9 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      caseId: 'NumericLessThan-matches-when-the-input-number-is-smaller-than-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '002-equal-default',
    title: 'takes the default branch when the input equals the rule value',
    group,
    tags: ['negative', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId:
        'NumericLessThan-returns-undefined-when-the-input-number-is-not-smaller-than-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '003-greater-default',
    title: 'takes the default branch when the input is greater than the rule value',
    group,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 11 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Complements the equality boundary with a clear greater-than non-match.',
    },
  }),
  matchChoiceCase({
    id: '004-negative-below',
    title: 'matches negative numbers below a negative threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: -2 } }],
    noMatchKey: defaultKey,
    input: { value: -3 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends ordering coverage to negative numeric comparisons.',
    },
  }),
  matchChoiceCase({
    id: '005-decimal-below',
    title: 'matches decimal numbers below the threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10.5 } }],
    noMatchKey: defaultKey,
    input: { value: 10.25 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends ordering coverage to decimal numeric comparisons.',
    },
  }),
  matchChoiceCase({
    id: '006-string-nonmatch',
    title: 'does not match a numeric string runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: '9' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'EdgeCases-type-mismatch-does-not-satisfy-choice-rule',
      notes: 'String input should not satisfy NumericLessThan.',
    },
  }),
  matchChoiceCase({
    id: '007-null-nonmatch',
    title: 'does not match a null runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericLessThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: null },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Null input should not satisfy NumericLessThan.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-nonmatch',
    title: 'fails with States.NoChoiceMatched when no branch matches and there is no default',
    group,
    tags: ['negative'],
    definition: buildNumericLessThanDefinition(10, false),
    input: { value: 10 },
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
