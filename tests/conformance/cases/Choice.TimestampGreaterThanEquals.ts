import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.TimestampGreaterThanEquals';
const matchedKey = 'matched';
const defaultKey = 'default';

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

const timestamps = {
  earlier: '2025-01-01T00:00:00.000Z',
  middle: '2025-01-01T12:00:00.000Z',
  middleOffset: '2025-01-01T07:00:00.000-05:00',
  later: '2025-01-02T00:00:00.000Z',
};

export const choiceTimestampGreaterThanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-later-than-rule',
    title: 'matches when the variable timestamp is later than the rule timestamp',
    group,
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: matchedKey,
        rule: {
          Variable: '$.detail.timestamp',
          TimestampGreaterThanEquals: timestamps.earlier,
        },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      detail: {
        timestamp: timestamps.middle,
      },
    },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId:
        'TimestampGreaterThanEquals/matches when the variable timestamp equals the rule timestamp',
      notes: 'Extends the legacy equality-only operator coverage to a later-than branch match.',
    },
  }),
  matchChoiceCase({
    id: '002-match-equal-rule',
    title: 'matches when the variable timestamp equals the rule timestamp',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      timestamp: timestamps.middle,
    },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      caseId:
        'TimestampGreaterThanEquals/matches when the variable timestamp equals the rule timestamp',
    },
  }),
  matchChoiceCase({
    id: '003-match-timezone-equivalent',
    title: 'matches when the variable timestamp is equivalent after timezone normalization',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      timestamp: timestamps.middleOffset,
    },
    expected: expectSelected(matchedKey),
    notes: 'Uses an offset form that represents the same instant as the rule value.',
  }),
  matchChoiceCase({
    id: '004-default-on-earlier',
    title:
      'falls through to default when the variable timestamp is earlier than the rule timestamp',
    group,
    tags: ['negative', 'branching'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      timestamp: timestamps.earlier,
    },
    expected: expectSelected(defaultKey),
  }),
  matchChoiceCase({
    id: '005-missing-variable-path',
    title: 'fails with States.Runtime when the variable path is missing',
    group,
    tags: ['negative', 'missing_path'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      observedAt: timestamps.later,
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
    id: '006-earlier-no-default',
    title:
      'fails with States.Runtime when the variable timestamp is earlier than the rule timestamp and no default is configured',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      {
        Variable: '$.timestamp',
        TimestampGreaterThanEquals: timestamps.middle,
      },
      { withDefault: false }
    ),
    input: {
      timestamp: timestamps.earlier,
    },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/states/index.spec.ts',
      caseId: 'runs a Choice state (without Default)',
      notes:
        'Covers the Choice-state transition failure when TimestampGreaterThanEquals evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-runtime-timestamp',
    title: 'catalogs malformed runtime timestamp input as a non-match',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThanEquals: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: {
      timestamp: 'not-a-timestamp',
    },
    expected: expectSelected(defaultKey),
    notes:
      'The current local operator uses Date.parse and treats NaN comparisons as false; this case preserves that observable behavior for later findings.',
  }),
];
