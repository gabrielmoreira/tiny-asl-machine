import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const expectSelected =
  (selected: string): ConformanceCase['expected'] =>
  (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };

const expectError =
  (error: string, ...causeParts: string[]): ConformanceCase['expected'] =>
  (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
    for (const causePart of causeParts) {
      expect(result.cause).toContain(causePart);
    }
  };

const timestamps = {
  earlier: '2025-01-01T00:00:00.000Z',
  middle: '2025-01-01T12:00:00.000Z',
  middleOffset: '2025-01-01T07:00:00.000-05:00',
  later: '2025-01-02T00:00:00.000Z',
};

export const choiceTimestampGreaterThanPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-later-than-path',
    title: 'matches when the variable timestamp path resolves later than the comparison path',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['happy_path', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.later,
      right: timestamps.middle,
    },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId: 'Path variants/matches TimestampGreaterThanPath',
    },
  }),
  matchChoiceCase({
    id: '002-match-nested-later',
    title: 'matches when nested timestamp paths resolve to a later and earlier instant',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.audit.completedAt', TimestampGreaterThanPath: '$.audit.startedAt' },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      audit: {
        startedAt: timestamps.middle,
        completedAt: timestamps.later,
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '003-default-on-equal',
    title: 'falls through to default when the compared timestamps are equal',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['negative', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middle,
      right: timestamps.middleOffset,
    },
    expected: expectSelected('defaulted'),
    notes: 'Equivalent instants must not satisfy a strict greater-than path comparison.',
  }),
  matchChoiceCase({
    id: '004-default-on-earlier',
    title:
      'falls through to default when the variable timestamp is earlier than the comparison path',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['negative', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.earlier,
      right: timestamps.middle,
    },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '005-missing-comparison-path',
    title: 'fails with States.Runtime when the comparison path is missing',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['negative', 'missing_path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.later,
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
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.left',
        TimestampGreaterThanPath: '$.right',
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
        'Covers the Choice-state transition failure when TimestampGreaterThanPath evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-comparison-path',
    title: 'catalogs malformed runtime timestamp data on the comparison path as a non-match',
    group: 'Choice.TimestampGreaterThanPath',
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.later,
      right: 'not-a-timestamp',
    },
    expected: expectSelected('defaulted'),
  }),
];
