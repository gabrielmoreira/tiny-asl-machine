import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.NumericLessThanPath';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectNoDefaultFailure(): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toContain('state does not point to a next state');
  };
}

export const choiceNumericLessThanPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-left-smaller-integer',
    title: 'matches when the left numeric path resolves to a smaller integer',
    group,
    tags: ['happy_path', 'branching', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: 8 },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Expands the direct NumericLessThanPath unit example into a black-box Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-equal-default',
    title: 'falls through to Default when both numeric paths resolve to the same value',
    group,
    tags: ['boundary', 'negative', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 8, right: 8 },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '003-larger-default',
    title: 'falls through to Default when the left numeric path resolves to a larger value',
    group,
    tags: ['negative', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 9, right: 8 },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '004-nested-ascending-match',
    title: 'matches when nested decimal paths resolve in ascending order',
    group,
    tags: ['happy_path', 'nested', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.payload.range.lower',
          NumericLessThanPath: '$.payload.range.upper',
        },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      payload: {
        range: {
          lower: -1.5,
          upper: -1.25,
        },
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '005-missing-right-path',
    title: 'fails with States.Runtime when the comparison path is missing',
    group,
    tags: ['negative', 'missing_path', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7 },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.right'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  customDefinitionCase({
    id: '006-no-default-equal',
    title:
      'fails with States.Runtime when the numeric paths resolve to the same value and there is no Default',
    group,
    tags: ['negative', 'no_default', 'path'],
    definition: buildChoiceDefinition(
      { Variable: '$.left', NumericLessThanPath: '$.right' },
      { withDefault: false }
    ),
    input: { left: 8, right: 8 },
    expected: expectNoDefaultFailure(),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Covers the no-default transition failure for a false NumericLessThanPath comparison.',
    },
  }),
  matchChoiceCase({
    id: '007-string-left-default',
    title: 'falls through to Default when the variable path resolves to a string runtime value',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: '7', right: 8 },
    expected: expectSelected('defaulted'),
    notes:
      'Representative invalid runtime shape: a string left operand should not satisfy a numeric ordering comparison.',
  }),
  matchChoiceCase({
    id: '008-boolean-right-default',
    title: 'falls through to Default when the comparison path resolves to a boolean runtime value',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericLessThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: true },
    expected: expectSelected('defaulted'),
    notes:
      'Representative invalid runtime shape: a boolean right operand should not satisfy a numeric ordering comparison.',
  }),
];
