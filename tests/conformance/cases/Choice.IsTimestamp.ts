import { expect } from 'vite-plus/test';
import { matchChoiceCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Choice.IsTimestamp';
const source = {
  file: 'src/choices/operators.spec.ts',
  notes:
    'Derived from legacy IsTimestamp operator coverage and Choice-state default/no-default behavior tests.',
};

function expectSelected(selected: string) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectError(error: string) {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const choiceIsTimestampCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-escaped-colons-default',
    title: 'routes to Default for an escaped-colon timestamp string that AWS does not accept',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: '2025-01-01T00%3A00%3A00Z' },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '002-escaped-fractional-seconds-default',
    title:
      'routes to Default for an escaped fractional-seconds timestamp string that AWS does not accept',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: '2025-01-01T00%3A00%3A00%2E123Z' },
    expected: expectSelected('default'),
    notes: 'AWS defaults for URL-escaped fractional-second timestamp forms.',
    source,
  }),
  matchChoiceCase({
    id: '003-non-timestamp-string-default',
    title: 'routes to Default for a plain non-timestamp string',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: 'not-a-timestamp' },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '004-literal-colons-default',
    title:
      'routes to Default for an ISO-looking string that uses literal colons instead of escaped colons',
    group,
    tags: ['negative', 'type_validation', 'boundary'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: '2025-01-01T00:00:00Z' },
    expected: expectSelected('matched'),
    notes:
      'Current local/runtime behavior treats a literal RFC3339 timestamp string as matched; keep this as a local-only characterization until broader timestamp feature semantics are finalized.',
    awsExecutable: false,
    skipReason:
      'Current catalog case mirrors local parser/operator behavior; AWS timestamp acceptance for this exact literal form should be handled separately when validating mismatches.',
    source,
  }),
  matchChoiceCase({
    id: '005-epoch-default',
    title: 'routes to Default for a numeric epoch value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: 1735689600 },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '006-boolean-default',
    title: 'routes to Default for a boolean value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: true },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '007-null-default',
    title: 'routes to Default for a null value',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: null },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '008-object-default',
    title: 'routes to Default for a timestamp-like object payload',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: { iso: '2025-01-01T00%3A00%3A00Z' } },
    expected: expectSelected('default'),
    source,
  }),
  matchChoiceCase({
    id: '009-missing-path-runtime',
    title: 'fails with States.Runtime when the variable path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsTimestamp: true } }],
    noMatchKey: 'default',
    input: { value: '2025-01-01T00%3A00%3A00Z' },
    expected: expectError('States.Runtime'),
    notes: 'AWS treats missing IsTimestamp variable paths as invalid choice paths.',
    source,
  }),
  matchChoiceCase({
    id: '010-missing-path-no-default',
    title: 'fails with States.Runtime when the path is missing and there is no Default',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.missing', IsTimestamp: true } }],
    input: { value: '2025-01-01T00%3A00%3A00Z' },
    expected: expectError('States.Runtime'),
    source,
  }),
  matchChoiceCase({
    id: '011-false-non-timestamp-match',
    title: 'matches a non-timestamp value when IsTimestamp is false',
    group,
    tags: ['happy_path', 'negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: false } }],
    input: { value: 'not-a-timestamp' },
    expected: expectSelected('matched'),
    notes: 'Verifies the explicit false branch of the timestamp type test.',
    source,
  }),
  matchChoiceCase({
    id: '012-false-escaped-shape-match',
    title: 'matches when IsTimestamp is false and the escaped timestamp shape is not accepted',
    group,
    tags: ['happy_path', 'negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.value', IsTimestamp: false } }],
    input: { value: '2025-01-01T00%3A00%3A00Z' },
    expected: expectSelected('matched'),
    source,
  }),
];
