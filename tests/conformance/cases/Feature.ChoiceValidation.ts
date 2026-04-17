import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.ChoiceValidation';

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectNoMatchWithoutDefault(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.Runtime');
    expect(result.cause).toEqual(expect.any(String));
    expect(result.cause).toContain('state does not point to a next state');
  };
}

function invalidDefinition(definition: unknown): ConformanceCase['definition'] {
  return definition as ConformanceCase['definition'];
}

const validationSkipReason =
  'Choice structural validation is currently enforced via AWS validation, not by the local runtime.';

export const featureChoiceValidationCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-no-default-no-choices-match',
    title: 'fails with States.Runtime when no Choice rule matches and there is no Default',
    group,
    tags: ['choice', 'runtime', 'no_default'],
    definition: {
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [{ Variable: '$.status', StringEquals: 'READY', Next: 'Ready' }],
        },
        Ready: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: { status: 'PENDING' },
    expected: expectNoMatchWithoutDefault(),
    source: {
      file: 'src/states/index.ts',
      notes:
        'Separates the classic no-match-without-Default runtime behavior from structural Choice definition failures.',
    },
  }),
  customDefinitionCase({
    id: '002-empty-choices-array-fails-validation',
    title: 'fails validation when a Choice state declares an empty Choices array',
    group,
    tags: ['choice', 'validation', 'structure'],
    definition: {
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [],
          Default: 'Fallback',
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '003-rule-without-comparator-fails-validation',
    title: 'fails validation when a Choice rule has Variable and Next but no comparator',
    group,
    tags: ['choice', 'validation', 'missing_comparator'],
    definition: invalidDefinition({
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [{ Variable: '$.status', Next: 'Matched' }],
          Default: 'Fallback',
        },
        Matched: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    }),
    input: { status: 'READY' },
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '004-invalid-variable-path-fails-validation',
    title: 'fails validation when a Choice Variable is not a valid reference path',
    group,
    tags: ['choice', 'validation', 'path'],
    definition: {
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [{ Variable: 'status', StringEquals: 'READY', Next: 'Matched' }],
          Default: 'Fallback',
        },
        Matched: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: { status: 'READY' },
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '005-mixed-comparators-in-one-rule-fails-validation',
    title: 'fails validation when one Choice rule mixes incompatible comparator shapes',
    group,
    tags: ['choice', 'validation', 'comparators'],
    definition: invalidDefinition({
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Variable: '$.value',
              StringEquals: '1',
              NumericGreaterThan: 0,
              Next: 'Matched',
            },
          ],
          Default: 'Fallback',
        },
        Matched: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    }),
    input: { value: '1' },
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '006-malformed-nested-or-under-not-fails-validation',
    title: 'fails validation when a nested logical Choice structure is malformed',
    group,
    tags: ['choice', 'validation', 'logical_operators', 'nested'],
    definition: {
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [{ Not: { Or: [] }, Next: 'Matched' }],
          Default: 'Fallback',
        },
        Matched: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: { status: 'READY' },
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
];
