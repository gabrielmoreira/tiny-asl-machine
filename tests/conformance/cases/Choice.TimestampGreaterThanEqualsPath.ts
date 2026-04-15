import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.TimestampGreaterThanEqualsPath';
const sourceFile = 'src/choices/operators.spec.ts';

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

export const choiceTimestampGreaterThanEqualsPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-equal-paths',
    title: 'matches when both timestamp paths are equal',
    group,
    tags: ['happy_path', 'boundary', 'path_comparison'],
    rules: [
      { key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right' } },
    ],
    noMatchKey: 'default',
    input: {
      left: '2025-01-01T00:00:10Z',
      right: '2025-01-01T00:00:10Z',
    },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Derived from the TimestampGreaterThanEqualsPath operator example.',
    },
  }),
  matchChoiceCase({
    id: '002-match-later-than-path',
    title: 'matches when the left timestamp is later than the right path timestamp',
    group,
    tags: ['happy_path', 'path_comparison'],
    rules: [
      {
        key: 'matched',
        rule: { Variable: '$.window.end', TimestampGreaterThanEqualsPath: '$.window.start' },
      },
    ],
    noMatchKey: 'default',
    input: {
      window: {
        start: '2025-01-01T00:00:00Z',
        end: '2025-01-01T00:05:00Z',
      },
    },
    expected: expectSelected('matched'),
    source: {
      file: sourceFile,
      notes: 'Extends the path variant coverage to nested reference paths.',
    },
  }),
  matchChoiceCase({
    id: '003-default-on-earlier',
    title: 'falls back to Default when the left timestamp is earlier than the right path timestamp',
    group,
    tags: ['negative', 'default_behavior', 'path_comparison'],
    rules: [
      { key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right' } },
    ],
    noMatchKey: 'default',
    input: {
      left: '2025-01-01T00:00:00Z',
      right: '2025-01-01T00:00:10Z',
    },
    expected: expectSelected('default'),
  }),
  matchChoiceCase({
    id: '004-missing-comparison-path',
    title: 'fails with States.Runtime when the comparison path is missing',
    group,
    tags: ['missing_path', 'negative', 'default_behavior'],
    rules: [
      { key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right' } },
    ],
    noMatchKey: 'default',
    input: {
      left: '2025-01-01T00:00:10Z',
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
    id: '005-missing-variable-path',
    title: 'fails with States.Runtime when the variable path is missing',
    group,
    tags: ['missing_path', 'negative', 'default_behavior'],
    rules: [
      { key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right' } },
    ],
    noMatchKey: 'default',
    input: {
      right: '2025-01-01T00:00:10Z',
    },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.left'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
  }),
  matchChoiceCase({
    id: '006-malformed-comparison-path',
    title: 'falls back to Default when the comparison path contains a non-timestamp string',
    group,
    tags: ['malformed_input', 'negative', 'default_behavior'],
    rules: [
      { key: 'matched', rule: { Variable: '$.left', TimestampGreaterThanEqualsPath: '$.right' } },
    ],
    noMatchKey: 'default',
    input: {
      left: '2025-01-01T00:00:10Z',
      right: 'not-a-timestamp',
    },
    expected: expectSelected('default'),
    notes: 'Useful runtime-input probe for AWS timestamp parsing behavior in path comparisons.',
  }),
  customDefinitionCase({
    id: '007-earlier-no-default',
    title:
      'fails with States.Runtime when the left timestamp is earlier than the right path timestamp and no default is configured',
    group,
    tags: ['negative', 'no_default', 'error_behavior'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.left',
        TimestampGreaterThanEqualsPath: '$.right',
      },
      { withDefault: false }
    ),
    input: {
      left: '2025-01-01T00:00:00Z',
      right: '2025-01-01T00:00:10Z',
    },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Covers the Choice-state transition failure when TimestampGreaterThanEqualsPath evaluates false and no default is configured.',
    },
  }),
];
