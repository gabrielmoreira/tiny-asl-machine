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

export const choiceTimestampEqualsPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-identical-paths-match',
    title: 'matches when both timestamp paths resolve to identical values',
    group: 'Choice.TimestampEqualsPath',
    tags: ['happy_path', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middle,
      right: timestamps.middle,
    },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId: 'Path variants/matches TimestampEqualsPath',
    },
  }),
  matchChoiceCase({
    id: '002-offset-equivalent-match',
    title: 'matches when both paths represent the same instant with different timezone offsets',
    group: 'Choice.TimestampEqualsPath',
    tags: ['happy_path', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middleOffset,
      right: timestamps.middle,
    },
    expected: expectSelected('matched'),
    notes: 'Validates equality after timestamp parsing rather than raw string equality.',
  }),
  matchChoiceCase({
    id: '003-nested-paths-match',
    title: 'matches when nested timestamp paths resolve to the same value',
    group: 'Choice.TimestampEqualsPath',
    tags: ['happy_path', 'nested'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.window.start', TimestampEqualsPath: '$.window.expectedStart' },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      window: {
        start: timestamps.middle,
        expectedStart: timestamps.middle,
      },
    },
    expected: expectSelected('matched'),
  }),
  matchChoiceCase({
    id: '004-different-instants-default',
    title: 'falls through to default when the two timestamp paths resolve to different instants',
    group: 'Choice.TimestampEqualsPath',
    tags: ['negative', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middle,
      right: timestamps.later,
    },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '005-missing-comparison-path-runtime',
    title: 'fails with States.Runtime when the comparison path is missing',
    group: 'Choice.TimestampEqualsPath',
    tags: ['negative', 'missing_path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middle,
    },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.right'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  matchChoiceCase({
    id: '006-missing-variable-path-runtime',
    title: 'fails with States.Runtime when the variable path is missing',
    group: 'Choice.TimestampEqualsPath',
    tags: ['negative', 'missing_path'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      right: timestamps.middle,
    },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.left'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  customDefinitionCase({
    id: '007-no-default-runtime',
    title:
      'fails with States.Runtime when the timestamps do not match and no default is configured',
    group: 'Choice.TimestampEqualsPath',
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.left',
        TimestampEqualsPath: '$.right',
      },
      { withDefault: false, checkStateName: 'CheckTimestamp' }
    ),
    input: {
      left: timestamps.earlier,
      right: timestamps.later,
    },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      caseId: 'runs a Choice state (without Default)',
      notes:
        'Covers the Choice-state transition failure when a timestamp path comparison evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '008-malformed-comparison-path-default',
    title: 'catalogs malformed runtime timestamp data on the comparison path as a non-match',
    group: 'Choice.TimestampEqualsPath',
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.left', TimestampEqualsPath: '$.right' } }],
    noMatchKey: 'defaulted',
    input: {
      left: timestamps.middle,
      right: 'not-a-timestamp',
    },
    expected: expectSelected('defaulted'),
  }),
];
