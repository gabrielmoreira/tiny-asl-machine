import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.TimestampLessThanPath';

const timestamps = {
  earlier: '2025-01-01T00:00:00.000Z',
  middle: '2025-01-01T12:00:00.000Z',
  middleOffset: '2025-01-01T07:00:00.000-05:00',
  later: '2025-01-02T00:00:00.000Z',
};

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectError(error: string, ...causeParts: string[]): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
    for (const causePart of causeParts) {
      expect(result.cause).toContain(causePart);
    }
  };
}
export const choiceTimestampLessThanPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-earlier-than-path',
    title: 'matches when the variable timestamp path resolves earlier than the comparison path',
    group,
    tags: ['happy_path', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampLessThanPath: '$.right' } }],
    noMatchKey: 'default',
    input: {
      left: timestamps.earlier,
      right: timestamps.middle,
    },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId: 'Path variants/matches TimestampLessThanPath',
    },
  }),
  matchChoiceCase({
    id: '002-match-nested-earlier',
    title: 'matches when nested timestamp paths resolve to an earlier and later instant',
    group,
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.window.start', TimestampLessThanPath: '$.window.end' },
      },
    ],
    noMatchKey: 'default',
    input: {
      window: {
        start: timestamps.middle,
        end: timestamps.later,
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '003-default-on-equal',
    title: 'falls through to default when the compared timestamps are equal',
    group,
    tags: ['negative', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampLessThanPath: '$.right' } }],
    noMatchKey: 'default',
    input: {
      left: timestamps.middleOffset,
      right: timestamps.middle,
    },
    expected: expectSelected('default'),
    notes: 'Equivalent instants must not satisfy a strict less-than path comparison.',
  }),
  matchChoiceCase({
    id: '004-default-on-later',
    title: 'falls through to default when the variable timestamp is later than the comparison path',
    group,
    tags: ['negative', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampLessThanPath: '$.right' } }],
    noMatchKey: 'default',
    input: {
      left: timestamps.later,
      right: timestamps.middle,
    },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '005-missing-comparison-path',
    title: 'fails with States.Runtime when the comparison path is missing',
    group,
    tags: ['negative', 'missing_path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampLessThanPath: '$.right' } }],
    noMatchKey: 'default',
    input: {
      left: timestamps.earlier,
    },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.right'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  customDefinitionCase({
    id: '006-equal-no-default',
    title:
      'fails with States.Runtime when the compared timestamps are equal and no default is configured',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.left',
        TimestampLessThanPath: '$.right',
      },
      { withDefault: false, checkStateName: 'CheckTimestamp' }
    ),
    input: {
      left: timestamps.middle,
      right: timestamps.middle,
    },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      caseId: 'runs a Choice state (without Default)',
      notes:
        'Covers the Choice-state transition failure when TimestampLessThanPath evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-comparison-path',
    title: 'catalogs malformed runtime timestamp data on the comparison path as a non-match',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampLessThanPath: '$.right' } }],
    noMatchKey: 'default',
    input: {
      left: timestamps.earlier,
      right: 'not-a-timestamp',
    },
    expected: expectSelected('default'),
  }),
];
