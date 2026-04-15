import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const GROUP = 'Choice.NumericGreaterThanEqualsPath';
const OPERATOR = 'NumericGreaterThanEqualsPath';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectError(error: string): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toContain('state does not point to a next state');
  };
}

export const choiceNumericGreaterThanEqualsPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-equal-integer-match',
    title: 'matches when both numeric paths resolve to the same integer',
    group: GROUP,
    tags: ['happy_path', 'boundary', 'branching', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
    input: { left: 8, right: 8 },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Expands the direct NumericGreaterThanEqualsPath unit example into a black-box Choice workflow.',
    },
  }),
  matchChoiceCase({
    id: '002-greater-value-match',
    title: 'matches when the left numeric path resolves to a larger value',
    group: GROUP,
    tags: ['happy_path', 'branching', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
    input: { left: 9, right: 8 },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '003-smaller-default',
    title: 'falls through to Default when the left numeric path resolves to a smaller value',
    group: GROUP,
    tags: ['negative', 'default_branch', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
    input: { left: 7, right: 8 },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '004-nested-equal-decimal',
    title: 'matches when nested decimal paths resolve to equal values',
    group: GROUP,
    tags: ['happy_path', 'nested', 'boundary', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.payload.measurements.actual',
          [OPERATOR]: '$.payload.measurements.minimum',
        },
      },
    ],
    noMatchKey: 'default',
    input: {
      payload: {
        measurements: {
          actual: 0.125,
          minimum: 0.125,
        },
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '005-missing-left-path',
    title: 'fails with States.Runtime when the variable path is missing',
    group: GROUP,
    tags: ['negative', 'missing_path', 'default_branch', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
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
    group: GROUP,
    tags: ['negative', 'no_default', 'path'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.left',
        [OPERATOR]: '$.right',
      },
      { withDefault: false }
    ),
    input: { left: 7, right: 8 },
    expected: expectError('States.Runtime'),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Covers the no-default transition failure for a false path-based numeric ordering comparison.',
    },
  }),
  matchChoiceCase({
    id: '007-object-left-default',
    title: 'falls through to Default when the variable path resolves to an object runtime value',
    group: GROUP,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
    input: { left: { value: 8 }, right: 8 },
    expected: expectSelected('default'),
    notes:
      'Representative invalid runtime shape: an object left operand should not satisfy a numeric ordering comparison.',
  }),
  matchChoiceCase({
    id: '008-boolean-right-default',
    title: 'falls through to Default when the comparison path resolves to a boolean runtime value',
    group: GROUP,
    tags: ['negative', 'type_validation', 'default_branch', 'path'],
    rules: [
      {
        key: 'matched',
        rule: {
          Variable: '$.left',
          [OPERATOR]: '$.right',
        },
      },
    ],
    noMatchKey: 'default',
    input: { left: 8, right: false },
    expected: expectSelected('default'),
    awsExecutable: false,
    skipReason:
      'AWS currently routes this false-valued comparison path to the matched branch, while the local runtime treats the mixed-type operand as a non-match; keep this characterization local-only until numeric-path coercion parity is addressed.',
    notes:
      "Local characterization retained for now. AWS currently returns { selected: 'matched' } for this input.",
  }),
];
