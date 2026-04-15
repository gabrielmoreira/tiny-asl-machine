import { expect } from 'vitest';
import { customDefinitionCase, matchChoiceCase } from '../support/builders';
import { buildChoiceDefinition } from '../support/buildChoiceDefinition';
import type { ConformanceCase } from '../support/types';

const group = 'Choice.BooleanEqualsPath';
const matchedKey = 'matched';
const defaultKey = 'default';

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

export const booleanEqualsPathCases: ConformanceCase[] = [
  matchChoiceCase({
    id: '001-both-true-match',
    title: 'matches when both boolean paths resolve to true',
    group,
    tags: ['happy_path', 'branching'],
    rules: [{ key: matchedKey, rule: { Variable: '$.left', BooleanEqualsPath: '$.right' } }],
    noMatchKey: defaultKey,
    input: { left: true, right: true },
    expected: expectSelected(matchedKey),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  matchChoiceCase({
    id: '002-both-false-match',
    title: 'matches when both boolean paths resolve to false',
    group,
    tags: ['happy_path', 'branching'],
    rules: [{ key: matchedKey, rule: { Variable: '$.left', BooleanEqualsPath: '$.right' } }],
    noMatchKey: defaultKey,
    input: { left: false, right: false },
    expected: expectSelected(matchedKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Expands path equality coverage to the false/false branch as well.',
    },
  }),
  matchChoiceCase({
    id: '003-default-paths-differ',
    title: 'uses the default branch when the boolean paths differ',
    group,
    tags: ['negative', 'branching'],
    rules: [{ key: matchedKey, rule: { Variable: '$.left', BooleanEqualsPath: '$.right' } }],
    noMatchKey: defaultKey,
    input: { left: true, right: false },
    expected: expectSelected(defaultKey),
    source: { file: 'src/choices/operators.spec.ts' },
  }),
  customDefinitionCase({
    id: '004-no-default-nonmatch',
    title: 'fails with States.Runtime when no path comparison matches and no default exists',
    group,
    tags: ['negative', 'no_default'],
    definition: buildChoiceDefinition(
      { Variable: '$.left', BooleanEqualsPath: '$.right' },
      { withDefault: false }
    ),
    input: { left: true, right: false },
    expected: expectNoChoiceMatched(),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Extends the generic no-default Choice-state coverage to BooleanEqualsPath.',
    },
  }),
  matchChoiceCase({
    id: '005-mixed-type-nonmatch',
    title: 'treats a string-vs-boolean path comparison as a non-match',
    group,
    tags: ['negative', 'type_validation'],
    rules: [{ key: matchedKey, rule: { Variable: '$.left', BooleanEqualsPath: '$.right' } }],
    noMatchKey: defaultKey,
    input: { left: 'true', right: true },
    expected: expectSelected(defaultKey),
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Representative mixed-type runtime input for BooleanEqualsPath.',
    },
  }),
  matchChoiceCase({
    id: '006-missing-right-path',
    title: 'fails with States.Runtime when the right-hand comparison path is missing',
    group,
    tags: ['negative', 'malformed_input'],
    rules: [{ key: matchedKey, rule: { Variable: '$.left', BooleanEqualsPath: '$.right' } }],
    noMatchKey: defaultKey,
    input: { left: true },
    expected: result => {
      expect(result.output).toBeUndefined();
      expect(result.error).toBe('States.Runtime');
      expect(result.cause).toEqual(expect.any(String));
      expect(result.cause).toContain("Invalid path '$.right'");
      expect(result.cause).toContain('condition path references an invalid value.');
    },
    source: {
      file: 'src/choices/operators.spec.ts',
      notes: 'Representative missing-path runtime input for path-based boolean comparison.',
    },
  }),
];
