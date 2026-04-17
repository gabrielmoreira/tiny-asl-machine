import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

function expectSelected(result: TestResult, selected: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
}

function expectError(
  result: TestResult,
  error: string,
  causePart = 'state does not point to a next state'
) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe(error);
  expect(result.cause).toEqual(expect.any(String));
  expect(result.cause).toContain(causePart);
}

export const choiceNotCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-inverts-false-to-true',
    title: 'routes to PublicFlow when the nested rule evaluates to false',
    group: 'Choice.Not',
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: 'public-flow',
        rule: {
          Not: { Variable: '$.visibility', StringEquals: 'Private' },
        },
      },
    ],
    noMatchKey: 'private-flow',
    input: { visibility: 'Public' },
    expected: result => expectSelected(result, 'public-flow'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Not inverts the nested rule result.',
    },
  }),
  matchChoiceCase({
    id: '002-default-inner-rule-true',
    title: 'takes the default branch when the nested rule already evaluates to true',
    group: 'Choice.Not',
    tags: ['negative', 'branching'],
    rules: [
      {
        key: 'public-flow',
        rule: {
          Not: { Variable: '$.visibility', StringEquals: 'Private' },
        },
      },
    ],
    noMatchKey: 'private-flow',
    input: { visibility: 'Private' },
    expected: result => expectSelected(result, 'private-flow'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Complements the basic Not case with the inverted branch outcome.',
    },
  }),
  matchChoiceCase({
    id: '003-not-inside-and',
    title: 'supports Not inside an And composition',
    group: 'Choice.Not',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'its-d',
        rule: {
          And: [
            { Variable: '$.value', StringMatches: 'D' },
            {
              Not: {
                Variable: '$.somethingElse',
                NumericEquals: 1,
              },
            },
          ],
        },
      },
    ],
    noMatchKey: 'unknown-value',
    input: { value: 'D', somethingElse: 2 },
    expected: result => expectSelected(result, 'its-d'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state scenario combining StringMatches with Not inside And.',
    },
  }),
  matchChoiceCase({
    id: '004-negates-composite-and',
    title: 'can negate a nested And rule as a single composite condition',
    group: 'Choice.Not',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'manual-review',
        rule: {
          Not: {
            And: [
              { Variable: '$.country', StringEquals: 'US' },
              { Variable: '$.vip', BooleanEquals: true },
            ],
          },
        },
      },
    ],
    noMatchKey: 'auto-approve',
    input: { country: 'US', vip: false },
    expected: result => expectSelected(result, 'manual-review'),
  }),
  matchChoiceCase({
    id: '005-type-mismatch-inverts-to-match',
    title: 'matches when the nested string comparison receives a non-string runtime value',
    group: 'Choice.Not',
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'public-flow',
        rule: {
          Not: { Variable: '$.visibility', StringEquals: 'Private' },
        },
      },
    ],
    noMatchKey: 'private-flow',
    input: { visibility: 1 },
    expected: result => expectSelected(result, 'public-flow'),
    notes:
      'The inner StringEquals should not match the numeric runtime value, so Not should invert the failure to success.',
  }),
  customDefinitionCase({
    id: '006-no-default-inner-match',
    title: 'fails with States.Runtime when the nested rule is true and there is no default',
    group: 'Choice.Not',
    tags: ['negative', 'no_default'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [
            {
              Not: { Variable: '$.visibility', StringEquals: 'Private' },
              Next: 'PublicFlow',
            },
          ],
        },
        PublicFlow: {
          Type: 'Pass',
          Result: { branch: 'public-flow' },
          End: true,
        },
      },
    },
    input: { visibility: 'Private' },
    expected: result =>
      expectError(result, 'States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'AWS snapshots report a runtime transition failure when nothing matches and no Default is configured.',
    },
  }),
];
