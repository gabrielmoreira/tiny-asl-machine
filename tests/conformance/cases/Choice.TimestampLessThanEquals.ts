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

export const choiceTimestampLessThanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-earlier-than-rule',
    title: 'matches when the variable timestamp is earlier than the rule timestamp',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.detail.timestamp', TimestampLessThanEquals: timestamps.later },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      detail: {
        timestamp: timestamps.middle,
      },
    },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId:
        'TimestampLessThanEquals/matches when the variable timestamp equals the rule timestamp',
      notes: 'Extends the legacy equality-only operator coverage to an earlier-than branch match.',
    },
  }),
  matchChoiceCase({
    id: '002-match-equal-rule',
    title: 'matches when the variable timestamp equals the rule timestamp',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.timestamp', TimestampLessThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      timestamp: timestamps.middle,
    },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId:
        'TimestampLessThanEquals/matches when the variable timestamp equals the rule timestamp',
    },
  }),
  matchChoiceCase({
    id: '003-match-timezone-equivalent',
    title: 'matches when the variable timestamp is equivalent after timezone normalization',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.timestamp', TimestampLessThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      timestamp: timestamps.middleOffset,
    },
    expected: expectSelected('matched'),
    notes: 'Exercises timestamp parsing instead of plain lexical comparison.',
  }),
  matchChoiceCase({
    id: '004-default-on-later',
    title: 'falls through to default when the variable timestamp is later than the rule timestamp',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['negative', 'branching'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.timestamp', TimestampLessThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      timestamp: timestamps.later,
    },
    expected: expectSelected('defaulted'),
  }),
  matchChoiceCase({
    id: '005-missing-variable-path',
    title: 'fails with States.Runtime when the variable path is missing',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['negative', 'missing_path'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.timestamp', TimestampLessThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      otherTimestamp: timestamps.earlier,
    },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.timestamp'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  customDefinitionCase({
    id: '006-later-no-default',
    title:
      'fails with States.Runtime when the variable timestamp is later than the rule timestamp and no default is configured',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.timestamp',
        TimestampLessThanEquals: timestamps.middle,
      },
      { withDefault: false }
    ),
    input: {
      timestamp: timestamps.later,
    },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      caseId: 'runs a Choice state (without Default)',
      notes:
        'Covers the Choice-state transition failure when TimestampLessThanEquals evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-runtime-timestamp',
    title: 'catalogs malformed runtime timestamp input as a non-match',
    group: 'Choice.TimestampLessThanEquals',
    tags: ['negative', 'malformed_input'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.timestamp', TimestampLessThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: 'defaulted',
    input: {
      timestamp: 'not-a-timestamp',
    },
    expected: expectSelected('defaulted'),
    notes:
      'The current local operator uses Date.parse and treats NaN comparisons as false; this case preserves that observable behavior for later findings.',
  }),
];
