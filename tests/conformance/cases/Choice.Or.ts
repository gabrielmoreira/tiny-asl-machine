import { expect } from 'vitest';
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

export const choiceOrCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-any-rule-match',
    title: 'routes to Priority when at least one nested rule evaluates to true',
    group: 'Choice.Or',
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: 'priority',
        rule: {
          Or: [
            { Variable: '$.category', StringEquals: 'gold' },
            { Variable: '$.points', NumericGreaterThanEquals: 1000 },
          ],
        },
      },
    ],
    noMatchKey: 'standard',
    input: { category: 'silver', points: 1000 },
    expected: result => expectSelected(result, 'priority'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Or matches when at least one nested rule evaluates to true.',
    },
  }),
  matchChoiceCase({
    id: '002-default-all-rules-false',
    title: 'takes the default branch when every nested rule evaluates to false',
    group: 'Choice.Or',
    tags: ['negative', 'branching'],
    rules: [
      {
        key: 'priority',
        rule: {
          Or: [
            { Variable: '$.category', StringEquals: 'gold' },
            { Variable: '$.points', NumericGreaterThanEquals: 1000 },
          ],
        },
      },
    ],
    noMatchKey: 'standard',
    input: { category: 'silver', points: 999 },
    expected: result => expectSelected(result, 'standard'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Or returns undefined when all nested rules evaluate to false.',
    },
  }),
  matchChoiceCase({
    id: '003-first-rule-true',
    title: 'still routes to the matching branch when the first nested rule is already true',
    group: 'Choice.Or',
    tags: ['happy_path'],
    rules: [
      {
        key: 'priority',
        rule: {
          Or: [
            { Variable: '$.category', StringEquals: 'gold' },
            { Variable: '$.points', NumericGreaterThanEquals: 1000 },
          ],
        },
      },
    ],
    noMatchKey: 'standard',
    input: { category: 'gold', points: 10 },
    expected: result => expectSelected(result, 'priority'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Uses the same Or rule with the first branch satisfied.',
    },
  }),
  matchChoiceCase({
    id: '004-stringmatches-alternative',
    title: 'matches when one StringMatches alternative inside Or succeeds',
    group: 'Choice.Or',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'known-value',
        rule: {
          Or: [
            { Variable: '$.value', StringMatches: 'A' },
            { Variable: '$.value', StringMatches: 'B' },
            { Variable: '$.value', StringMatches: 'C' },
          ],
        },
      },
    ],
    noMatchKey: 'unknown-value',
    input: { value: 'B' },
    expected: result => expectSelected(result, 'known-value'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state with Or over multiple StringMatches alternatives.',
    },
  }),
  matchChoiceCase({
    id: '005-nested-and-rule',
    title: 'supports an Or rule containing a nested And rule',
    group: 'Choice.Or',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'escalate',
        rule: {
          Or: [
            {
              And: [
                { Variable: '$.status', StringEquals: 'READY' },
                { Variable: '$.verified', BooleanEquals: true },
              ],
            },
            { Variable: '$.priority', StringEquals: 'urgent' },
          ],
        },
      },
    ],
    noMatchKey: 'queue',
    input: { status: 'READY', verified: true, priority: 'normal' },
    expected: result => expectSelected(result, 'escalate'),
  }),
  matchChoiceCase({
    id: '006-default-numeric-type-mismatch',
    title: 'does not match when a numeric member rule receives a string runtime value',
    group: 'Choice.Or',
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'priority',
        rule: {
          Or: [
            { Variable: '$.category', StringEquals: 'gold' },
            { Variable: '$.points', NumericGreaterThanEquals: 1000 },
          ],
        },
      },
    ],
    noMatchKey: 'standard',
    input: { category: 'silver', points: '1000' },
    expected: result => expectSelected(result, 'standard'),
    notes:
      'AWS is expected to treat the string runtime value as not satisfying NumericGreaterThanEquals.',
  }),
  customDefinitionCase({
    id: '007-no-default-all-rules-fail',
    title: 'fails with States.Runtime when no Or branch matches and there is no default',
    group: 'Choice.Or',
    tags: ['negative', 'no_default'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [
            {
              Or: [
                { Variable: '$.category', StringEquals: 'gold' },
                { Variable: '$.points', NumericGreaterThanEquals: 1000 },
              ],
              Next: 'Priority',
            },
          ],
        },
        Priority: {
          Type: 'Pass',
          Result: { branch: 'priority' },
          End: true,
        },
      },
    },
    input: { category: 'silver', points: 999 },
    expected: result =>
      expectError(result, 'States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'AWS snapshots report a runtime transition failure when nothing matches and no Default is configured.',
    },
  }),
];
