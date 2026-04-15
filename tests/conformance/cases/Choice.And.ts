import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

function expectSelected(result: TestResult, selected: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ selected });
}

function expectError(result: TestResult, error: string, causePart = 'Choice State') {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe(error);
  expect(result.cause).toEqual(expect.any(String));
  expect(result.cause).toContain(causePart);
}

export const choiceAndCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-all-rules-match',
    title: 'routes to Approved when all nested rules match',
    group: 'Choice.And',
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: 'approved',
        rule: {
          And: [
            { Variable: '$.status', StringEquals: 'READY' },
            { Variable: '$.attempt', NumericGreaterThanEquals: 2 },
          ],
        },
      },
    ],
    noMatchKey: 'rejected',
    input: { status: 'READY', attempt: 2 },
    expected: result => expectSelected(result, 'approved'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'And matches when all nested rules evaluate to true.',
    },
  }),
  matchChoiceCase({
    id: '002-default-any-rule-fails',
    title: 'takes the default branch when any nested rule evaluates to false',
    group: 'Choice.And',
    tags: ['negative', 'branching'],
    rules: [
      {
        key: 'approved',
        rule: {
          And: [
            { Variable: '$.status', StringEquals: 'READY' },
            { Variable: '$.attempt', NumericGreaterThanEquals: 2 },
          ],
        },
      },
    ],
    noMatchKey: 'manual-review',
    input: { status: 'READY', attempt: 1 },
    expected: result => expectSelected(result, 'manual-review'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'And returns undefined when any nested rule evaluates to false.',
    },
  }),
  matchChoiceCase({
    id: '003-nested-and-rules',
    title: 'supports nested And rules inside another And',
    group: 'Choice.And',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'high-value-order',
        rule: {
          And: [
            {
              And: [
                { Variable: '$.kind', StringEquals: 'order' },
                { Variable: '$.confirmed', BooleanEquals: true },
              ],
            },
            { Variable: '$.total', NumericGreaterThan: 100 },
          ],
        },
      },
    ],
    noMatchKey: 'fallback',
    input: { kind: 'order', confirmed: true, total: 150 },
    expected: result => expectSelected(result, 'high-value-order'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Nested logical And scenario.',
    },
  }),
  matchChoiceCase({
    id: '004-contained-or-rule',
    title: 'supports an And rule that contains an Or rule',
    group: 'Choice.And',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'fast-track',
        rule: {
          And: [
            {
              Or: [
                { Variable: '$.tier', StringEquals: 'gold' },
                { Variable: '$.expedited', BooleanEquals: true },
              ],
            },
            { Variable: '$.amount', NumericGreaterThan: 50 },
          ],
        },
      },
    ],
    noMatchKey: 'standard-track',
    input: { tier: 'silver', expedited: true, amount: 75 },
    expected: result => expectSelected(result, 'fast-track'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Edge case covering an And rule containing an Or rule.',
    },
  }),
  matchChoiceCase({
    id: '005-default-numeric-type-mismatch',
    title: 'does not match when a numeric member rule receives a string runtime value',
    group: 'Choice.And',
    tags: ['negative', 'type_validation'],
    rules: [
      {
        key: 'fast-track',
        rule: {
          And: [
            {
              Or: [
                { Variable: '$.tier', StringEquals: 'gold' },
                { Variable: '$.expedited', BooleanEquals: true },
              ],
            },
            { Variable: '$.amount', NumericGreaterThan: 50 },
          ],
        },
      },
    ],
    noMatchKey: 'standard-track',
    input: { tier: 'silver', expedited: true, amount: '75' },
    expected: result => expectSelected(result, 'standard-track'),
    notes:
      'AWS is expected to treat the string runtime value as not satisfying NumericGreaterThan.',
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends the nested And+Or scenario with a wrong runtime value type.',
    },
  }),
  customDefinitionCase({
    id: '006-no-default-no-match',
    title: 'fails with States.Runtime when no And branch matches and there is no default',
    group: 'Choice.And',
    tags: ['negative', 'no_default'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [
            {
              And: [
                { Variable: '$.status', StringEquals: 'READY' },
                { Variable: '$.attempt', NumericGreaterThanEquals: 2 },
              ],
              Next: 'Approved',
            },
          ],
        },
        Approved: {
          Type: 'Pass',
          Result: { branch: 'approved' },
          End: true,
        },
      },
    },
    input: { status: 'READY', attempt: 1 },
    expected: result =>
      expectError(result, 'States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'AWS snapshots report a runtime transition failure when nothing matches and no Default is configured.',
    },
  }),
];
