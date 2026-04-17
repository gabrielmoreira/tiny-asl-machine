import { expect } from 'vite-plus/test';
import {
  customDefinitionCase,
  multiExpressionCase,
  singleExpressionCase,
} from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'States.MathRandom';
const sourceFile = 'tests/support/conformance/intrinsicCases/States.MathRandom.ts';

function expectAnyFailure(result: TestResult) {
  expect(result.output).toBeUndefined();
  expect(result.error).toBeTruthy();
  expect(result.cause).toEqual(expect.any(String));
}

function expectIntrinsicFailure(causeIncludes?: string[]) {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toEqual(expect.any(String));

    for (const snippet of causeIncludes ?? []) {
      expect(result.cause).toContain(snippet);
    }
  };
}

function expectOutput(output: unknown) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectIntegerInRange(start: number, endExclusive: number) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toMatchObject({ value: expect.any(Number) });
    const value = (result.output as { value: number }).value;
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(start);
    expect(value).toBeLessThan(endExclusive);
  };
}

function expectIntegerArrayInRange(count: number, start: number, endExclusive: number) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(Array.isArray(result.output)).toBe(true);

    const values = result.output as unknown[];
    expect(values).toHaveLength(count);
    for (const value of values) {
      expect(typeof value).toBe('number');
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(start);
      expect(value).toBeLessThan(endExclusive);
    }
  };
}

function expectSingleSeededValue(start: number, endExclusive: number) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toMatchObject({ value: expect.any(Number) });
    const value = (result.output as { value: number }).value;
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(start);
    expect(value).toBeLessThan(endExclusive);
  };
}

function setupLocalRandomSequence(...values: number[]) {
  let index = 0;

  return () => ({
    random: (min: number, max: number) => {
      const fallback = values[values.length - 1] ?? min;
      const value = values[Math.min(index++, values.length - 1)] ?? fallback;
      return Math.max(min, Math.min(value, max - 1));
    },
  });
}
export const statesMathRandomCases: ConformanceCase[] = [
  singleExpressionCase({
    id: '001-integer-in-positive-range',
    title: 'returns an integer in a basic positive range',
    group,
    tags: ['happy_path'],
    expression: 'States.MathRandom(1, 999)',
    input: {},
    expected: expectIntegerInRange(1, 999),
    setupLocal: setupLocalRandomSequence(868),
    notes: 'Primary AWS characterization case for inclusive-start, exclusive-end semantics.',
    source: { file: sourceFile, caseId: 'MRAND-001' },
  }),
  multiExpressionCase({
    id: '002-repeated-seed-deterministic',
    title: 'repeats the same seed in one outer expression deterministically',
    group,
    tags: ['happy_path', 'deterministic', 'seeded'],
    expressions: {
      first: 'States.MathRandom(1, 100, 42)',
      second: 'States.MathRandom(1, 100, 42)',
    },
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        first: expect.any(Number),
        second: expect.any(Number),
      });
      const output = result.output as { first: number; second: number };
      expect(Number.isInteger(output.first)).toBe(true);
      expect(Number.isInteger(output.second)).toBe(true);
      expect(output.first).toBeGreaterThanOrEqual(1);
      expect(output.first).toBeLessThan(100);
      expect(output.second).toBeGreaterThanOrEqual(1);
      expect(output.second).toBeLessThan(100);
      expect(output.second).toBe(output.first);
    },
    source: { file: sourceFile, caseId: 'MRAND-003' },
  }),
  multiExpressionCase({
    id: '003-compare-different-seeds',
    title: 'compares different seeds side by side without asserting distinctness',
    group,
    tags: ['seeded', 'deterministic', 'boundary'],
    expressions: {
      first: 'States.MathRandom(1, 1000, 1)',
      second: 'States.MathRandom(1, 1000, 2)',
    },
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        first: expect.any(Number),
        second: expect.any(Number),
      });
      const output = result.output as { first: number; second: number };
      for (const value of [output.first, output.second]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThan(1000);
      }
    },
    notes:
      'Different seeds may theoretically collide, so this case validates range and seeded executability rather than inequality.',
    source: { file: sourceFile, caseId: 'MRAND-004' },
  }),
  singleExpressionCase({
    id: '004-reject-identical-bounds',
    title: 'fails when start and end bounds are identical',
    group,
    tags: ['negative', 'boundary', 'range_limit'],
    expression: 'States.MathRandom(1, 1)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-005' },
  }),
  singleExpressionCase({
    id: '005-reject-reversed-bounds',
    title: 'rejects reversed bounds',
    group,
    tags: ['negative', 'boundary', 'range_limit'],
    expression: 'States.MathRandom(10, 5)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-006' },
  }),
  singleExpressionCase({
    id: '006-round-bounds-before-generation',
    title: 'rounds both bounds before generation',
    group,
    tags: ['happy_path', 'rounding'],
    expression: 'States.MathRandom(1.4, 5.6)',
    input: {},
    expected: expectIntegerInRange(1, 6),
    setupLocal: setupLocalRandomSequence(2),
    notes: 'AWS documents nearest-integer rounding for start and end bounds.',
    source: { file: sourceFile, caseId: 'MRAND-007' },
  }),
  singleExpressionCase({
    id: '007-round-bounds-to-narrower-interval',
    title: 'rounds bounds to a narrower interval',
    group,
    tags: ['happy_path', 'rounding'],
    expression: 'States.MathRandom(1.6, 5.4)',
    input: {},
    expected: expectIntegerInRange(1, 5),
    setupLocal: setupLocalRandomSequence(3),
    notes:
      'AWS observation currently allows 1 here, so the effective lower bound behaves wider than simple nearest-integer rounding would suggest.',
    source: { file: sourceFile, caseId: 'MRAND-008' },
  }),
  customDefinitionCase({
    id: '007b-round-bounds-to-narrower-interval-many-samples',
    title: 'observes 50 rounded random samples inside the narrowed interval',
    group,
    tags: ['happy_path', 'rounding', 'aws_observation'],
    definition: {
      StartAt: 'CollectSamples',
      States: {
        CollectSamples: {
          Type: 'Map',
          ItemsPath: '$.slots',
          Iterator: {
            StartAt: 'Sample',
            States: {
              Sample: {
                Type: 'Pass',
                Parameters: {
                  'value.$': 'States.MathRandom(1.6, 5.4)',
                },
                OutputPath: '$.value',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      slots: Array.from({ length: 50 }, (_, index) => index),
    },
    expected: expectIntegerArrayInRange(50, 1, 5),
    notes:
      'Characterization case to give the observed lower/upper bounds repeated chances through 50 independent iterations in one execution.',
    source: { file: sourceFile, caseId: 'MRAND-008B' },
  }),
  singleExpressionCase({
    id: '008-round-to-single-output',
    title: 'rounds into a single possible output interval',
    group,
    tags: ['happy_path', 'rounding', 'boundary'],
    expression: 'States.MathRandom(1.4, 1.6)',
    input: {},
    expected: expectOutput({ value: 1 }),
    awsExecutable: false,
    skipReason:
      'AWS currently rejects the rounded singleton interval for States.MathRandom(1.4, 1.6) with Invalid arguments in States.MathRandom instead of returning the sole valid output 1; keep this characterization local-only until singleton-interval parity is aligned.',
    notes: 'Rounds to the effective interval [1, 2), so only 1 is valid.',
    source: { file: sourceFile, caseId: 'MRAND-009' },
  }),
  singleExpressionCase({
    id: '009-fail-rounding-collapsed-bounds',
    title: 'fails when rounding collapses bounds to the same integer',
    group,
    tags: ['negative', 'rounding', 'boundary'],
    expression: 'States.MathRandom(1.49, 1.49)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-010' },
  }),
  singleExpressionCase({
    id: '010-reject-string-start-bound',
    title: 'rejects a string start bound',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathRandom('a', 10)",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-011' },
  }),
  singleExpressionCase({
    id: '011-reject-string-end-bound',
    title: 'rejects a string end bound',
    group,
    tags: ['negative', 'type_validation'],
    expression: "States.MathRandom(1, 'b')",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-012' },
  }),
  singleExpressionCase({
    id: '012-reject-string-seed',
    title: 'rejects a string seed',
    group,
    tags: ['negative', 'type_validation', 'seeded'],
    expression: "States.MathRandom(1, 10, 'seed')",
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-013' },
  }),
  singleExpressionCase({
    id: '013-reject-missing-end-argument',
    title: 'rejects a missing end argument',
    group,
    tags: ['negative', 'arity'],
    expression: 'States.MathRandom(1)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'MRAND-014' },
  }),
  singleExpressionCase({
    id: '014-reject-fourth-argument',
    title: 'rejects a fourth argument beyond the documented signature',
    group,
    tags: ['negative', 'arity'],
    expression: 'States.MathRandom(1, 10, 5, 99)',
    input: {},
    expected: result => expectAnyFailure(result),
    source: { file: sourceFile, caseId: 'MRAND-015' },
  }),
  singleExpressionCase({
    id: '015-accept-negative-seed',
    title: 'accepts a negative seed',
    group,
    tags: ['happy_path', 'seeded', 'boundary'],
    expression: 'States.MathRandom(1, 10, -10)',
    input: {},
    expected: expectSingleSeededValue(1, 10),
    source: { file: sourceFile, caseId: 'MRAND-016' },
  }),
  singleExpressionCase({
    id: '016-accept-zero-seed',
    title: 'accepts a zero seed',
    group,
    tags: ['happy_path', 'seeded', 'boundary'],
    expression: 'States.MathRandom(1, 10, 0)',
    input: {},
    expected: expectSingleSeededValue(1, 10),
    source: { file: sourceFile, caseId: 'MRAND-017' },
  }),
  singleExpressionCase({
    id: '017-fractional-seed-rounding',
    title: 'documents fractional seed rounding behavior',
    group,
    tags: ['seeded', 'rounding', 'boundary'],
    expression: 'States.MathRandom(1, 10, 2.6)',
    input: {},
    expected: expectSingleSeededValue(1, 10),
    awsExecutable: false,
    skipReason:
      'The AWS docs explicitly describe start/end rounding but do not clearly specify whether seed values are rounded before use; retain this as a non-portable observation case.',
    source: { file: sourceFile, caseId: 'MRAND-018' },
  }),
  singleExpressionCase({
    id: '018-reject-null-seed',
    title: 'rejects a null seed',
    group,
    tags: ['negative', 'type_validation', 'seeded'],
    expression: 'States.MathRandom(1, 10, null)',
    input: {},
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-019' },
  }),
  singleExpressionCase({
    id: '019-nested-mathadd-bounds',
    title: 'uses nested MathAdd calls for both bounds',
    group,
    tags: ['happy_path', 'nested', 'seeded'],
    expression: 'States.MathRandom(States.MathAdd($.base, 1), States.MathAdd($.base, 5), 42)',
    input: { base: 0 },
    expected: expectIntegerInRange(1, 5),
    source: { file: sourceFile, caseId: 'MRAND-020' },
  }),
  multiExpressionCase({
    id: '020-bounds-and-seed-from-context',
    title: 'reads bounds and seed from execution input context',
    group,
    tags: ['happy_path', 'context', 'seeded'],
    expressions: {
      value:
        'States.MathRandom($$.Execution.Input.start, $$.Execution.Input.end, $$.Execution.Input.seed)',
      startFromContext: '$$.Execution.Input.start',
    },
    input: { start: 1, end: 10, seed: 42 },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        value: expect.any(Number),
        startFromContext: 1,
      });
      const output = result.output as { value: number; startFromContext: number };
      expect(Number.isInteger(output.value)).toBe(true);
      expect(output.value).toBeGreaterThanOrEqual(1);
      expect(output.value).toBeLessThan(10);
      expect(output.startFromContext).toBe(1);
    },
    source: { file: sourceFile, caseId: 'MRAND-021' },
  }),
  singleExpressionCase({
    id: '021-large-symmetric-range',
    title: 'handles a large symmetric range around zero',
    group,
    tags: ['happy_path', 'range_limit'],
    expression: 'States.MathRandom($.start, $.end)',
    input: { start: -1000000, end: 1000000 },
    expected: expectIntegerInRange(-1000000, 1000000),
    setupLocal: setupLocalRandomSequence(-433633),
    source: { file: sourceFile, caseId: 'MRAND-022' },
  }),
  singleExpressionCase({
    id: '022-seeded-output-near-int32-max',
    title: 'maps seeded output near the int32 upper boundary',
    group,
    tags: ['happy_path', 'range_limit', 'seeded', 'boundary'],
    expression: 'States.MathRandom($.start, $.end, $.seed)',
    input: { start: 2147483640, end: 2147483647, seed: 1 },
    expected: expectIntegerInRange(2147483640, 2147483647),
    source: { file: sourceFile, caseId: 'MRAND-023' },
  }),
  multiExpressionCase({
    id: '023-repeated-seeded-calls',
    title: 'repeats identical seeded calls in one expression',
    group,
    tags: ['happy_path', 'deterministic', 'seeded'],
    expressions: {
      first: 'States.MathRandom(1, 10, 42)',
      second: 'States.MathRandom(1, 10, 42)',
    },
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        first: expect.any(Number),
        second: expect.any(Number),
      });
      const output = result.output as { first: number; second: number };
      expect(output.first).toBe(output.second);
      expect(output.first).toBeGreaterThanOrEqual(1);
      expect(output.first).toBeLessThan(10);
    },
    notes: 'Explicit purity probe for evaluation inside a larger intrinsic tree.',
    source: { file: sourceFile, caseId: 'MRAND-024' },
  }),
  multiExpressionCase({
    id: '024-unseeded-sibling-calls',
    title: 'observes two unseeded sibling calls independently',
    group,
    tags: ['happy_path', 'nondeterministic'],
    expressions: {
      first: 'States.MathRandom(1, 10)',
      second: 'States.MathRandom(1, 10)',
    },
    input: {},
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        first: expect.any(Number),
        second: expect.any(Number),
      });
      const output = result.output as { first: number; second: number };
      for (const value of [output.first, output.second]) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThan(10);
      }
    },
    setupLocal: setupLocalRandomSequence(5, 9),
    notes:
      'AWS should not be treated as deterministic here; both results are validated only for type and range.',
    source: { file: sourceFile, caseId: 'MRAND-025' },
  }),
  singleExpressionCase({
    id: '025-mixed-sign-interval',
    title: 'handles a mixed-sign interval crossing zero',
    group,
    tags: ['happy_path', 'boundary', 'seeded'],
    expression: 'States.MathRandom(-5, 5, 42)',
    input: {},
    expected: expectIntegerInRange(-5, 5),
    awsExecutable: false,
    skipReason:
      'AWS currently maps seeded mixed-sign MathRandom intervals differently from the local seeded generator (for example, seed 42 over [-5, 5) yields -5 on AWS); keep this range-only case local until the shared seeded parity fix lands.',
    source: { file: sourceFile, caseId: 'MRAND-026' },
  }),
  singleExpressionCase({
    id: '026-reject-null-start-bound',
    title: 'rejects a null start bound from input',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.MathRandom($.start, $.end)',
    input: { start: null, end: 10 },
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-027' },
  }),
  singleExpressionCase({
    id: '027-reject-null-end-bound',
    title: 'rejects a null end bound from input',
    group,
    tags: ['negative', 'type_validation'],
    expression: 'States.MathRandom($.start, $.end)',
    input: { start: 1, end: null },
    expected: expectIntrinsicFailure(),
    source: { file: sourceFile, caseId: 'MRAND-028' },
  }),
];
