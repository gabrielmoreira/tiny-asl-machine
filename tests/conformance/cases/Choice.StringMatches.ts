import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const GROUP = 'Choice.StringMatches';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectBranch(result: TestResult, branch: string) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual({ branch });
}

function expectNoDefaultFailure(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toContain('state does not point to a next state');
}

export const choiceStringMatchesCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-exact-string-match',
    title: 'matches an exact string',
    group: GROUP,
    tags: ['happy_path'],
    rules: [
      { key: 'exact-pattern', rule: { Variable: '$.value', StringMatches: 'invoice-2025.json' } },
    ],
    noMatchKey: 'no-pattern-match',
    input: { value: 'invoice-2025.json' },
    expected: expectSelected('exact-pattern'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'StringMatches exact string scenario.',
    },
  }),
  matchChoiceCase({
    id: '002-single-wildcard-match',
    title: 'matches a pattern with a single wildcard',
    group: GROUP,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: 'single-wildcard-pattern',
        rule: { Variable: '$.value', StringMatches: 'invoice-*.json' },
      },
    ],
    noMatchKey: 'no-pattern-match',
    input: { value: 'invoice-2025.json' },
    expected: expectSelected('single-wildcard-pattern'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Wildcard pattern with a single asterisk.',
    },
  }),
  matchChoiceCase({
    id: '003-multiple-wildcards-match',
    title: 'matches a pattern with multiple wildcards',
    group: GROUP,
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'multi-wildcard-pattern',
        rule: { Variable: '$.value', StringMatches: 'logs-*-*-done' },
      },
    ],
    noMatchKey: 'no-pattern-match',
    input: { value: 'logs-2025-04-done' },
    expected: expectSelected('multi-wildcard-pattern'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Multiple wildcard StringMatches scenario.',
    },
  }),
  matchChoiceCase({
    id: '004-escaped-asterisk-literal',
    title: 'treats an escaped asterisk as a literal character',
    group: GROUP,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: 'escaped-asterisk-literal',
        rule: { Variable: '$.value', StringMatches: 'file\\*name.txt' },
      },
    ],
    noMatchKey: 'no-pattern-match',
    input: { value: 'file*name.txt' },
    expected: expectSelected('escaped-asterisk-literal'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Escaped wildcard should be treated as a literal asterisk.',
    },
  }),
  matchChoiceCase({
    id: '005-default-on-nonmatch',
    title: 'takes the default branch when the pattern does not match',
    group: GROUP,
    tags: ['negative'],
    rules: [
      {
        key: 'single-wildcard-pattern',
        rule: { Variable: '$.value', StringMatches: 'invoice-*.json' },
      },
    ],
    noMatchKey: 'no-pattern-match',
    input: { value: 'report-2025.json' },
    expected: expectSelected('no-pattern-match'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'StringMatches returns undefined when the pattern does not match.',
    },
  }),
  customDefinitionCase({
    id: '006-or-alternative-match',
    title: 'matches when one of several StringMatches alternatives succeeds inside Or',
    group: GROUP,
    tags: ['happy_path', 'nested'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [
            {
              Or: [
                { Variable: '$.value', StringMatches: 'A' },
                { Variable: '$.value', StringMatches: 'B' },
                { Variable: '$.value', StringMatches: 'C' },
              ],
              Next: 'KnownValue',
            },
          ],
          Default: 'UnknownValue',
        },
        KnownValue: {
          Type: 'Pass',
          Result: { branch: 'known-value' },
          End: true,
        },
        UnknownValue: {
          Type: 'Pass',
          Result: { branch: 'unknown-value' },
          End: true,
        },
      },
    },
    input: { value: 'C' },
    expected: result => expectBranch(result, 'known-value'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state with Or of StringMatches alternatives.',
    },
  }),
  customDefinitionCase({
    id: '007-and-not-composition',
    title: 'supports StringMatches inside And together with Not',
    group: GROUP,
    tags: ['happy_path', 'nested'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [
            {
              And: [
                { Variable: '$.value', StringMatches: 'D' },
                {
                  Not: {
                    Variable: '$.somethingElse',
                    NumericEquals: 1,
                  },
                },
              ],
              Next: 'ItsD',
            },
          ],
          Default: 'UnknownValue',
        },
        ItsD: {
          Type: 'Pass',
          Result: { branch: 'its-d' },
          End: true,
        },
        UnknownValue: {
          Type: 'Pass',
          Result: { branch: 'unknown-value' },
          End: true,
        },
      },
    },
    input: { value: 'D', somethingElse: 2 },
    expected: result => expectBranch(result, 'its-d'),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state combining StringMatches with Not inside And.',
    },
  }),
  matchChoiceCase({
    id: '008-nonstring-runtime-default',
    title: 'does not match when the runtime value is numeric instead of string',
    group: GROUP,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'exact-pattern', rule: { Variable: '$.value', StringMatches: '123' } }],
    noMatchKey: 'no-pattern-match',
    input: { value: 123 },
    expected: expectSelected('no-pattern-match'),
    notes:
      'AWS is expected to require a string runtime value for StringMatches rather than coercing non-strings.',
  }),
  customDefinitionCase({
    id: '009-no-default-nonmatch',
    title: 'fails with States.Runtime when the pattern does not match and there is no default',
    group: GROUP,
    tags: ['negative', 'no_default'],
    definition: {
      StartAt: 'Check',
      States: {
        Check: {
          Type: 'Choice',
          Choices: [{ Variable: '$.value', StringMatches: 'invoice-*.json', Next: 'Matched' }],
        },
        Matched: {
          Type: 'Pass',
          Result: { branch: 'matched' },
          End: true,
        },
      },
    },
    input: { value: 'report-2025.json' },
    expected: result => expectNoDefaultFailure(result),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Choice state without Default fails with a transition error when nothing matches.',
    },
  }),
];
