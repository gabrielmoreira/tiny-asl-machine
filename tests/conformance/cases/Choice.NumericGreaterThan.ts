import { expect } from 'vitest';
import { matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.NumericGreaterThan';
const sourceFile = 'src/choices/operators.spec.ts';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected =
  (selected: string): ConformanceCase['expected'] =>
  (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };

const expectError =
  (error: string, ...causeParts: string[]): ConformanceCase['expected'] =>
  (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
    for (const causePart of causeParts) {
      expect(result.cause).toContain(causePart);
    }
  };

export const choiceNumericGreaterThanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-larger-match',
    title: 'matches when the input number is larger than the rule value',
    group,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 11 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      caseId: 'NumericGreaterThan-matches-when-the-input-number-is-larger-than-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '002-equal-default',
    title: 'takes the default branch when the input equals the rule value',
    group,
    tags: ['negative', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 10 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId:
        'NumericGreaterThan-returns-undefined-when-the-input-number-is-not-larger-than-the-rule-value',
    },
  }),
  matchChoiceCase({
    id: '003-smaller-default',
    title: 'takes the default branch when the input is smaller than the rule value',
    group,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: 9 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Complements the equality boundary with a clear less-than non-match.',
    },
  }),
  matchChoiceCase({
    id: '004-negative-above',
    title: 'matches negative numbers above a negative threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: -2 } }],
    noMatchKey: defaultKey,
    input: { value: -1 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends ordering coverage to negative numeric comparisons.',
    },
  }),
  matchChoiceCase({
    id: '005-decimal-above',
    title: 'matches decimal numbers above the threshold',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10.25 } }],
    noMatchKey: defaultKey,
    input: { value: 10.5 },
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
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: '11' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'EdgeCases-type-mismatch-does-not-satisfy-choice-rule',
      notes: 'String input should not satisfy NumericGreaterThan.',
    },
  }),
  matchChoiceCase({
    id: '007-object-nonmatch',
    title: 'does not match an object runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    noMatchKey: defaultKey,
    input: { value: { amount: 11 } },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Object input should not satisfy NumericGreaterThan.',
    },
  }),
  matchChoiceCase({
    id: '008-no-default-nonmatch',
    title: 'fails with States.Runtime when no branch matches and there is no default',
    group,
    tags: ['negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericGreaterThan: 10 } }],
    input: { value: 10 },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: sourceFile,
      caseId: 'ChoiceState-no-default-no-match',
    },
  }),
];
