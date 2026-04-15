import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.FailPaths';

function expectFailure(error: string, cause: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toBe(cause);
  };
}

export const featureFailPathCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-fail-errorpath-and-causepath-jsonpath',
    title: 'JSONPath Fail can read ErrorPath and CausePath from input',
    group,
    tags: ['jsonpath', 'fail', 'error_path', 'cause_path'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          ErrorPath: '$.Error',
          CausePath: '$.Cause',
        },
      },
    },
    input: {
      Error: 'PathDerivedError',
      Cause: 'path derived cause',
    },
    expected: expectFailure('PathDerivedError', 'path derived cause'),
  }),
  customDefinitionCase({
    id: '002-fail-errorpath-only-jsonpath',
    title: 'JSONPath Fail can read ErrorPath and still use the default Cause',
    group,
    tags: ['jsonpath', 'fail', 'error_path'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          ErrorPath: '$.Error',
        },
      },
    },
    input: {
      Error: 'PathOnlyError',
    },
    expected: expectFailure('PathOnlyError', 'FAILED'),
  }),
  customDefinitionCase({
    id: '003-fail-causepath-only-jsonpath',
    title: 'JSONPath Fail can read CausePath and still use the default Error',
    group,
    tags: ['jsonpath', 'fail', 'cause_path'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          CausePath: '$.Cause',
        },
      },
    },
    input: {
      Cause: 'PathOnlyCause',
    },
    expected: expectFailure('FAILED', 'PathOnlyCause'),
  }),
  customDefinitionCase({
    id: '004-fail-static-error-and-cause-jsonpath',
    title: 'JSONPath Fail supports static Error and Cause strings',
    group,
    tags: ['jsonpath', 'fail', 'error', 'cause'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Error: 'StaticJsonPathError',
          Cause: 'static fail cause',
        },
      },
    },
    input: {},
    expected: expectFailure('StaticJsonPathError', 'static fail cause'),
  }),
  customDefinitionCase({
    id: '005-fail-errorpath-non-string-value-fails',
    title: 'JSONPath Fail.ErrorPath fails when the selected value is not a string',
    group,
    tags: ['jsonpath', 'fail', 'error_path', 'negative'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          ErrorPath: '$.Error',
        },
      },
    },
    input: {
      Error: 123,
    },
    expected: expectFailure('States.Runtime', "Expected string value at path '$.Error'."),
    awsExecutable: false,
    skipReason:
      'Pins current local runtime behavior for non-string ErrorPath values without yet asserting AWS wording parity.',
  }),
];
