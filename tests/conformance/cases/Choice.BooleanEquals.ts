import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.BooleanEquals';

function expectSelected(selected: string): ConformanceCase['expected'] {
  return result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual({ selected });
  };
}

function expectNoChoiceMatched(): ConformanceCase['expected'] {
  return result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toEqual(expect.any(String));
    expect(result.cause).toContain('state does not point to a next state');
  };
}

export const booleanEqualsCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-true-match',
    title: 'matches true values and routes to the matched branch',
    group,
    tags: ['happy_path', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.approved', BooleanEquals: true } }],
    noMatchKey: 'default',
    input: { approved: true },
    expected: expectSelected('matched'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '002-false-match',
    title: 'matches false values and routes to the matched branch',
    group,
    tags: ['happy_path', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.approved', BooleanEquals: false } }],
    noMatchKey: 'default',
    input: { approved: false },
    expected: expectSelected('matched'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '003-default-value-mismatch',
    title: 'uses the default branch when the boolean value does not match',
    group,
    tags: ['negative', 'branching'],
    rules: [{ key: 'matched', rule: { Variable: '$.approved', BooleanEquals: true } }],
    noMatchKey: 'default',
    input: { approved: false },
    expected: expectSelected('default'),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  customDefinitionCase({
    id: '004-no-default-nonmatch',
    title: 'fails with States.Runtime when no boolean rule matches and no default exists',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      { Variable: '$.approved', BooleanEquals: true },
      { withDefault: false }
    ),
    input: { approved: false },
    expected: expectNoChoiceMatched(),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends the generic no-default Choice-state coverage to BooleanEquals.',
    },
  }),
  matchChoiceCase({
    id: '005-string-runtime-nonmatch',
    title: 'treats string runtime input as a non-match for a boolean comparison',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: 'matched', rule: { Variable: '$.approved', BooleanEquals: true } }],
    noMatchKey: 'default',
    input: { approved: 'true' },
    expected: expectSelected('default'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Derived from the mixed-type choice edge-case coverage.',
    },
  }),
  matchChoiceCase({
    id: '006-nested-and-match',
    title: 'supports BooleanEquals inside a nested And rule',
    group,
    tags: ['happy_path', 'nested', 'branching'],
    rules: [
      {
        key: 'matched',
        rule: {
          And: [
            { Variable: '$.kind', StringEquals: 'order' },
            { Variable: '$.confirmed', BooleanEquals: true },
          ],
        },
      },
    ],
    noMatchKey: 'default',
    input: { kind: 'order', confirmed: true },
    expected: expectSelected('matched'),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Promotes the nested logical BooleanEquals unit scenario into the unified catalog.',
    },
  }),
  matchChoiceCase({
    id: '007-missing-compared-path',
    title: 'fails with States.Runtime when the compared path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: 'matched', rule: { Variable: '$.approved', BooleanEquals: true } }],
    noMatchKey: 'default',
    input: { status: 'PENDING' },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.approved'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Representative missing-path runtime input for boolean comparison.',
    },
  }),
];
