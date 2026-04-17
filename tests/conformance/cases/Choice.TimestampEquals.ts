import { expect } from 'vite-plus/test';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.TimestampEquals';

const timestamps = {
  earlier: '2025-01-01T00:00:00.000Z',
  middle: '2025-01-01T12:00:00.000Z',
  later: '2025-01-02T00:00:00.000Z',
  middleWithoutMillis: '2025-01-01T12:00:00Z',
};

function expectSelected(selected: string) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectNoChoiceMatched(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBe('States.Runtime');
  expect(result.cause).toEqual(expect.any(String));
  expect(result.cause).toContain('state does not point to a next state');
}

export const timestampEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-identical-timestamps-match',
    title: 'matches identical ISO8601 timestamps',
    group,
    tags: ['happy_path', 'branching'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: timestamps.middle },
    expected: expectSelected('matched'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '002-normalized-utc-match',
    title: 'treats equivalent UTC timestamps with and without milliseconds as equal',
    group,
    tags: ['happy_path', 'boundary'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: timestamps.middleWithoutMillis },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Adds normalization coverage for equivalent ISO8601 UTC forms.',
    },
  }),
  matchChoiceCase({
    id: '003-earlier-default',
    title: 'uses the default branch when the runtime timestamp is earlier than the rule timestamp',
    group,
    tags: ['negative', 'branching'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: timestamps.earlier },
    expected: expectSelected('default'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '004-later-default',
    title: 'uses the default branch when the runtime timestamp is later than the rule timestamp',
    group,
    tags: ['negative', 'branching'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: timestamps.later },
    expected: expectSelected('default'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  customDefinitionCase({
    id: '005-no-default-runtime',
    title:
      'fails with States.Runtime when no timestamp equality rule matches and no default exists',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      { Variable: '$.timestamp', TimestampEquals: timestamps.middle },
      { withDefault: false }
    ),
    input: { timestamp: timestamps.earlier },
    expected: result => expectNoChoiceMatched(result),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends the generic no-default Choice-state coverage to TimestampEquals.',
    },
  }),
  matchChoiceCase({
    id: '006-malformed-runtime-default',
    title: 'treats a malformed runtime timestamp string as a non-match',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: 'not-a-timestamp' },
    expected: expectSelected('default'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Inspired by the invalid timestamp string coverage under IsTimestamp.',
    },
  }),
  matchChoiceCase({
    id: '007-malformed-rule-default',
    title: 'treats a malformed timestamp literal in the rule as a non-match',
    group,
    tags: ['negative', 'invalid_definition'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: 'not-a-timestamp' } },
    ],
    noMatchKey: 'default',
    input: { timestamp: timestamps.middle },
    expected: expectSelected('default'),
    awsExecutable: false,
    skipReason:
      'Useful for catalog breadth, but AWS validation/runtime handling for malformed timestamp literals in comparison rules should be captured separately before enabling dual execution.',
    source: {
      file: 'src/choices/operators.ts',
      notes:
        'Documents current local comparison behavior when Date.parse returns NaN for the rule operand.',
    },
  }),
  matchChoiceCase({
    id: '008-date-only-string-default',
    title: 'treats a date-only runtime string as a non-match against a full timestamp literal',
    group,
    tags: ['negative', 'boundary'],
    rules: [
      { key: 'matched', rule: { Variable: '$.timestamp', TimestampEquals: timestamps.middle } },
    ],
    noMatchKey: 'default',
    input: { timestamp: '2025-01-01' },
    expected: expectSelected('default'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes:
        'Covers a date-like string that is distinct from the full ISO8601 timestamp required by the rule.',
    },
  }),
];
