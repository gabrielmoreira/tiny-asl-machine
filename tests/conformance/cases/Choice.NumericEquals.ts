import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.NumericEquals';
const sourceFile = 'src/choices/operators.spec.ts';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected = (selected: string) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
};

function buildNumericEqualsDefinition(ruleValue: number, withDefault = true) {
  return buildChoiceDefinition(
    {
      Variable: '$.value',
      NumericEquals: ruleValue,
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

export const choiceNumericEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-identical-integer',
    title: 'matches an identical integer value',
    group,
    tags: ['happy_path'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 42 } }],
    noMatchKey: defaultKey,
    input: { value: 42 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      caseId: 'NumericEquals-matches-identical-numbers',
    },
  }),
  matchChoiceCase({
    id: '002-different-integer-default',
    title: 'takes the default branch for a different integer value',
    group,
    tags: ['negative', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 42 } }],
    noMatchKey: defaultKey,
    input: { value: 41 },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'NumericEquals-returns-undefined-for-a-different-number',
    },
  }),
  matchChoiceCase({
    id: '003-identical-negative',
    title: 'matches an identical negative number',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: -7 } }],
    noMatchKey: defaultKey,
    input: { value: -7 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends the direct numeric equality coverage to negative values.',
    },
  }),
  matchChoiceCase({
    id: '004-identical-decimal',
    title: 'matches an identical decimal number',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 3.5 } }],
    noMatchKey: defaultKey,
    input: { value: 3.5 },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Extends the direct numeric equality coverage to decimal values.',
    },
  }),
  matchChoiceCase({
    id: '005-string-nonmatch',
    title: 'does not match a numeric string runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 42 } }],
    noMatchKey: defaultKey,
    input: { value: '42' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'EdgeCases-type-mismatch-does-not-satisfy-choice-rule',
      notes: 'String input should not satisfy NumericEquals on AWS Step Functions.',
    },
  }),
  matchChoiceCase({
    id: '006-boolean-nonmatch',
    title: 'does not match a boolean runtime value',
    group,
    tags: ['type_validation', 'negative'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 1 } }],
    noMatchKey: defaultKey,
    input: { value: true },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      caseId: 'EdgeCases-type-mismatch-does-not-satisfy-choice-rule',
      notes: 'Boolean input should not satisfy NumericEquals.',
    },
  }),
  matchChoiceCase({
    id: '007-missing-path-runtime',
    title: 'fails with States.Runtime when the variable path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 42 } }],
    noMatchKey: defaultKey,
    input: {},
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.value'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
    source: {
      file: sourceFile,
      notes: 'Missing runtime data should behave like a non-match when Default is present.',
    },
  }),
  customDefinitionCase({
    id: '008-no-default-nonmatch',
    title: 'fails with States.NoChoiceMatched when no branch matches and there is no default',
    group,
    tags: ['negative'],
    definition: buildNumericEqualsDefinition(42, false),
    input: { value: 99 },
    expected: result => {
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toContain('state does not point to a next state');
    },
    source: {
      file: sourceFile,
      caseId: 'ChoiceState-no-default-no-match',
      notes:
        'Based on the no-default choice-state failure behavior exercised in the choice and state specs.',
    },
  }),
  matchChoiceCase({
    id: '009-decimal-string-nonmatch',
    title: 'does not match a numeric-looking decimal string runtime value',
    group,
    tags: ['type_validation', 'negative', 'boundary'],
    rules: [{ key: matchedKey, rule: { Variable: '$.value', NumericEquals: 3.5 } }],
    noMatchKey: defaultKey,
    input: { value: '3.5' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes:
        'Decimal-looking strings must remain distinct from numeric runtime values during NumericEquals checks.',
    },
  }),
];
