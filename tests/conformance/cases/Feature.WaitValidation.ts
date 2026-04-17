import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.WaitValidation';
const sourceFile = 'src/states/index.ts';
const validationSkipReason = 'Wait definition validation currently requires AWS validation.';

function buildWaitDefinition(waitFields: Record<string, unknown>): ConformanceCase['definition'] {
  return {
    StartAt: 'WaitHere',
    States: {
      WaitHere: {
        Type: 'Wait',
        ...waitFields,
        End: true,
      },
    },
  } as unknown as ConformanceCase['definition'];
}

function expectFailure(error: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectValidationFailure(): ConformanceCase['expected'] {
  return expectFailure('VALIDATION_FAILED');
}

function expectRuntimeFailure(): ConformanceCase['expected'] {
  return expectFailure('States.Runtime');
}

export const featureWaitValidationCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-multiple-timing-fields',
    title: 'rejects a Wait state with more than one timing field',
    group,
    tags: ['wait', 'validation', 'negative'],
    definition: buildWaitDefinition({
      Seconds: 1,
      Timestamp: '2025-01-01T00:00:10.000Z',
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
    source: {
      file: sourceFile,
      notes: 'Covers classic exclusive-field validation for Wait timing selectors.',
    },
  }),
  customDefinitionCase({
    id: '002-no-timing-field',
    title: 'rejects a Wait state with no timing field configured',
    group,
    tags: ['wait', 'validation', 'negative'],
    definition: buildWaitDefinition({}),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
    source: {
      file: sourceFile,
      notes:
        'Ensures a Wait state cannot be defined without Seconds, SecondsPath, Timestamp, or TimestampPath.',
    },
  }),
  customDefinitionCase({
    id: '003-negative-seconds-literal',
    title: 'rejects a negative Seconds literal',
    group,
    tags: ['wait', 'validation', 'seconds', 'negative'],
    definition: buildWaitDefinition({ Seconds: -1 }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
    source: {
      file: sourceFile,
      notes: 'Characterizes definition-time validation for out-of-range literal Seconds values.',
    },
  }),
  customDefinitionCase({
    id: '004-non-integer-seconds-literal',
    title: 'rejects a non-integer Seconds literal',
    group,
    tags: ['wait', 'validation', 'seconds', 'negative'],
    definition: buildWaitDefinition({ Seconds: 1.5 }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
    source: {
      file: sourceFile,
      notes: 'Guards the integer-only contract for JSONPath Wait.Seconds literals.',
    },
  }),
  customDefinitionCase({
    id: '005-invalid-timestamp-literal',
    title: 'rejects an invalid Timestamp literal string',
    group,
    tags: ['wait', 'validation', 'timestamp', 'negative'],
    definition: buildWaitDefinition({ Timestamp: 'not-a-timestamp' }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
    source: {
      file: sourceFile,
      notes:
        'Keeps malformed literal Timestamp coverage in the validation bucket rather than clock-sensitive runtime behavior.',
    },
  }),
  customDefinitionCase({
    id: '006-secondspath-non-number',
    title: 'fails with States.Runtime when SecondsPath resolves to a non-numeric object',
    group,
    tags: ['wait', 'runtime', 'seconds_path', 'negative'],
    definition: buildWaitDefinition({ SecondsPath: '$.waitSeconds' }),
    input: { waitSeconds: { raw: '3' } },
    expected: expectRuntimeFailure(),
    source: {
      file: sourceFile,
      notes:
        'Uses an unambiguously non-numeric object value to avoid AWS coercion of numeric-looking strings.',
    },
  }),
  customDefinitionCase({
    id: '007-timestamppath-non-string',
    title: 'fails with States.Runtime when TimestampPath resolves to a non-string',
    group,
    tags: ['wait', 'runtime', 'timestamp_path', 'negative'],
    definition: buildWaitDefinition({ TimestampPath: '$.resumeAt' }),
    input: { resumeAt: 1_735_689_600_000 },
    expected: expectRuntimeFailure(),
    source: {
      file: sourceFile,
      notes: 'Covers runtime string validation before timestamp parsing occurs.',
    },
  }),
  customDefinitionCase({
    id: '008-missing-secondspath',
    title: 'fails with States.Runtime when SecondsPath is missing from the input',
    group,
    tags: ['wait', 'runtime', 'seconds_path', 'missing_path'],
    definition: buildWaitDefinition({ SecondsPath: '$.waitSeconds' }),
    input: { requestId: 'req-missing-seconds' },
    expected: expectRuntimeFailure(),
    source: {
      file: sourceFile,
      notes:
        'Distinguishes missing-path runtime failure from malformed literal Seconds validation.',
    },
  }),
  customDefinitionCase({
    id: '009-missing-timestamppath',
    title: 'fails with States.Runtime when TimestampPath is missing from the input',
    group,
    tags: ['wait', 'runtime', 'timestamp_path', 'missing_path'],
    definition: buildWaitDefinition({ TimestampPath: '$.resumeAt' }),
    input: { requestId: 'req-missing-timestamp' },
    expected: expectRuntimeFailure(),
    source: {
      file: sourceFile,
      notes:
        'Distinguishes missing-path runtime failure from malformed literal Timestamp validation.',
    },
  }),
];
