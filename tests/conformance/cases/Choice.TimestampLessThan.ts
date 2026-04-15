import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.TimestampLessThan';
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
  later: '2025-01-02T00:00:00.000Z',
  boundaryStart: '2025-01-01T23:59:59.999Z',
  boundaryEnd: '2025-01-02T00:00:00.000Z',
};

export const timestampLessThanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-match-earlier-than-rule',
    title: 'matches when the runtime timestamp is earlier than the rule timestamp',
    group,
    tags: ['happy_path', 'branching'],
    rules: [
      { key: matchedKey, rule: { Variable: '$.timestamp', TimestampLessThan: timestamps.later } },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.middle },
    expected: expectSelected(matchedKey),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '002-match-boundary-before-midnight',
    title: 'matches across a millisecond boundary immediately before midnight UTC',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampLessThan: timestamps.boundaryEnd },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.boundaryStart },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Adds a tight ordering boundary around adjacent UTC instants.',
    },
  }),
  matchChoiceCase({
    id: '003-default-on-equal',
    title: 'uses the default branch when the timestamps are equal',
    group,
    tags: ['negative', 'boundary'],
    rules: [
      { key: matchedKey, rule: { Variable: '$.timestamp', TimestampLessThan: timestamps.middle } },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.middle },
    expected: expectSelected(defaultKey),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '004-default-on-later',
    title: 'uses the default branch when the runtime timestamp is later than the rule timestamp',
    group,
    tags: ['negative', 'branching'],
    rules: [
      { key: matchedKey, rule: { Variable: '$.timestamp', TimestampLessThan: timestamps.middle } },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.later },
    expected: expectSelected(defaultKey),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  customDefinitionCase({
    id: '005-equal-no-default',
    title: 'fails with States.Runtime when the timestamps are equal and no default exists',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      { Variable: '$.timestamp', TimestampLessThan: timestamps.middle },
      { withDefault: false }
    ),
    input: { timestamp: timestamps.middle },
    expected: expectError('States.Runtime', 'state does not point to a next state'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Covers the Choice-state transition failure when TimestampLessThan evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '006-malformed-runtime-timestamp',
    title: 'treats a malformed runtime timestamp string as a non-match for less-than comparison',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [
      { key: matchedKey, rule: { Variable: '$.timestamp', TimestampLessThan: timestamps.middle } },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: 'not-a-timestamp' },
    expected: expectSelected(defaultKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Inspired by the invalid timestamp string coverage under IsTimestamp.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-rule-timestamp',
    title:
      'treats a malformed timestamp literal in the rule as a non-match for less-than comparison',
    group,
    tags: ['negative', 'invalid_definition'],
    rules: [
      { key: matchedKey, rule: { Variable: '$.timestamp', TimestampLessThan: 'not-a-timestamp' } },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.middle },
    expected: expectSelected(defaultKey),
    awsExecutable: false,
    skipReason:
      'Useful for catalog breadth, but AWS validation/runtime handling for malformed timestamp literals in comparison rules should be captured separately before enabling dual execution.',
    source: {
      file: 'src/choices/operators.ts',
      notes:
        'Documents current local comparison behavior when Date.parse returns NaN for the rule operand.',
    },
  }),
];
