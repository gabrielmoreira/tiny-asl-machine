import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.NumericEqualsPath';

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

export const choiceNumericEqualsPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-top-level-equal-integer',
    title: 'matches when both top-level numeric paths resolve to the same integer',
    group,
    tags: ['happy_path', 'branching', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: 7 },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Expands the direct NumericEqualsPath unit example into a black-box Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-different-values-default',
    title: 'falls through to Default when the numeric paths resolve to different values',
    group,
    tags: ['negative', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: 8 },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '003-nested-equal-decimal',
    title: 'matches when nested left and right paths resolve to the same decimal value',
    group,
    tags: ['happy_path', 'nested', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.payload.metrics.current',
          NumericEqualsPath: '$.payload.metrics.expected',
        },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      payload: {
        metrics: {
          current: 12.5,
          expected: 12.5,
        },
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '004-missing-right-path',
    title: 'fails with States.Runtime when the comparison path is missing',
    group,
    tags: ['negative', 'missing_path', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericEqualsPath: '$.right' } }],
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
    id: '005-missing-left-path-no-default',
    title: 'fails with States.Runtime when the variable path is missing and there is no Default',
    group,
    tags: ['negative', 'missing_path', 'no_default', 'path'],
    definition: buildChoiceDefinition(
      { Variable: '$.left', NumericEqualsPath: '$.right' },
      { withDefault: false }
    ),
    input: { right: 7 },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.left'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Mirrors the no-default Choice behavior while exercising a path-based numeric comparison.',
    },
  }),
  matchChoiceCase({
    id: '006-string-left-default',
    title:
      'falls through to Default when the variable path resolves to a string instead of a number',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: '7', right: 7 },
    expected: expectSelected('defaulted'),
    notes:
      'Representative invalid runtime shape: non-numeric left operand should not satisfy a numeric path comparison.',
  }),
  matchChoiceCase({
    id: '007-object-right-default',
    title:
      'falls through to Default when the comparison path resolves to an object instead of a number',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: { value: 7 } },
    expected: expectSelected('defaulted'),
    notes:
      'Representative invalid runtime shape: non-numeric right operand should not satisfy a numeric path comparison.',
  }),
  customDefinitionCase({
    id: '008-no-default-nonmatch',
    title:
      'fails with States.Runtime when the numeric paths resolve to different values and there is no Default',
    group,
    tags: ['negative', 'no_default', 'path'],
    definition: buildChoiceDefinition(
      { Variable: '$.left', NumericEqualsPath: '$.right' },
      { withDefault: false }
    ),
    input: { left: 7, right: 8 },
    expected: expectNoDefaultFailure(),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Covers the no-default transition failure for a false NumericEqualsPath comparison.',
    },
  }),
];
