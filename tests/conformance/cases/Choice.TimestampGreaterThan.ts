import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.TimestampGreaterThan';
const sourceFile = 'src/choices/operators.spec.ts';
const matchedKey = 'matched';
const defaultKey = 'default';

const expectSelected =
  (selected: string): ConformanceCase['expected'] =>
  result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };

function expectNoChoiceMatched(): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toContain('state does not point to a next state');
  };
}

const timestamps = {
  earlier: '2025-01-01T00:00:00.000Z',
  middle: '2025-01-01T12:00:00.000Z',
  later: '2025-01-02T00:00:00.000Z',
  boundaryStart: '2025-01-02T00:00:00.000Z',
  boundaryEnd: '2025-01-01T23:59:59.999Z',
};

export const timestampGreaterThanCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-later-than-rule-match',
    title: 'matches when the runtime timestamp is later than the rule timestamp',
    group,
    tags: ['happy_path', 'branching'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: timestamps.earlier },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.middle },
    expected: expectSelected(matchedKey),
    source: { file: sourceFile },
  }),
  matchChoiceCase({
    id: '002-boundary-after-midnight-match',
    title: 'matches across a millisecond boundary immediately after midnight UTC',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: timestamps.boundaryEnd },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.boundaryStart },
    expected: expectSelected(matchedKey),
    source: {
      file: sourceFile,
      notes: 'Adds a tight ordering boundary around adjacent UTC instants.',
    },
  }),
  matchChoiceCase({
    id: '003-equal-default',
    title: 'uses the default branch when the timestamps are equal',
    group,
    tags: ['negative', 'boundary'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.middle },
    expected: expectSelected(defaultKey),
    source: { file: sourceFile },
  }),
  matchChoiceCase({
    id: '004-earlier-default',
    title: 'uses the default branch when the runtime timestamp is earlier than the rule timestamp',
    group,
    tags: ['negative', 'branching'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: timestamps.earlier },
    expected: expectSelected(defaultKey),
    source: { file: sourceFile },
  }),
  customDefinitionCase({
    id: '005-equal-no-default',
    title: 'fails with States.Runtime when the timestamps are equal and no default exists',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      { Variable: '$.timestamp', TimestampGreaterThan: timestamps.middle },
      { withDefault: false }
    ),
    input: { timestamp: timestamps.middle },
    expected: expectNoChoiceMatched(),
    source: {
      file: sourceFile,
      notes:
        'Covers the Choice-state transition failure when TimestampGreaterThan evaluates false and no default is configured.',
    },
  }),
  matchChoiceCase({
    id: '006-malformed-runtime-default',
    title: 'treats a malformed runtime timestamp string as a non-match for greater-than comparison',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: timestamps.middle },
      },
    ],
    noMatchKey: defaultKey,
    input: { timestamp: 'not-a-timestamp' },
    expected: expectSelected(defaultKey),
    source: {
      file: sourceFile,
      notes: 'Inspired by the invalid timestamp string coverage under IsTimestamp.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-rule-default',
    title:
      'treats a malformed timestamp literal in the rule as a non-match for greater-than comparison',
    group,
    tags: ['negative', 'invalid_definition'],
    rules: [
      {
        key: matchedKey,
        rule: { Variable: '$.timestamp', TimestampGreaterThan: 'not-a-timestamp' },
      },
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
