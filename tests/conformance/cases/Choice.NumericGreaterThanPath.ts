import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.NumericGreaterThanPath';

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

export const choiceNumericGreaterThanPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-left-greater-integer',
    title: 'matches when the left numeric path resolves to a larger integer',
    group,
    tags: ['happy_path', 'branching', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 9, right: 8 },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Expands the direct NumericGreaterThanPath unit example into a black-box Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-equal-default',
    title: 'falls through to Default when both numeric paths resolve to the same value',
    group,
    tags: ['boundary', 'negative', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 8, right: 8 },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '003-smaller-default',
    title: 'falls through to Default when the left numeric path resolves to a smaller value',
    group,
    tags: ['negative', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: 8 },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '004-nested-descending-match',
    title: 'matches when nested decimal paths resolve in descending order',
    group,
    tags: ['happy_path', 'nested', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.payload.range.upper',
          NumericGreaterThanPath: '$.payload.range.lower',
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
    id: '005-missing-left-path',
    title: 'fails with States.Runtime when the variable path is missing',
    group,
    tags: ['negative', 'missing_path', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { right: 8 },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.left'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  customDefinitionCase({
    id: '006-no-default-smaller',
    title:
      'fails with States.Runtime when the left numeric path resolves to a smaller value and there is no Default',
    group,
    tags: ['negative', 'no_default', 'path'],
    definition: buildChoiceDefinition(
      { Variable: '$.left', NumericGreaterThanPath: '$.right' },
      { withDefault: false }
    ),
    input: { left: 7, right: 8 },
    expected: expectNoDefaultFailure(),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Covers the no-default transition failure for a false NumericGreaterThanPath comparison.',
    },
  }),
  matchChoiceCase({
    id: '007-null-left-default',
    title: 'falls through to Default when the variable path resolves to null',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: null, right: 8 },
    expected: expectSelected('defaulted'),
    notes:
      'Representative invalid runtime shape: a null left operand should not satisfy a numeric ordering comparison.',
  }),
  matchChoiceCase({
    id: '008-array-right-default',
    title: 'falls through to Default when the comparison path resolves to an array runtime value',
    group,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', NumericGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: { left: 7, right: [6] },
    expected: expectSelected('defaulted'),
    awsExecutable: false,
    skipReason:
      'AWS currently routes this single-element array comparison path to the matched branch, while the local runtime treats the mixed-type operand as a non-match; keep this characterization local-only until numeric-path coercion parity is addressed.',
    notes:
      "Local characterization retained for now. AWS currently returns { selected: 'matched' } for right: [6].",
  }),
];
