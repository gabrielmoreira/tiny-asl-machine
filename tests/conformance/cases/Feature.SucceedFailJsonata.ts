import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.SucceedFailJsonata';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectFailure(error: string, cause: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toBe(cause);
  };
}

export const featureSucceedFailJsonataCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-succeed-output-jsonata',
    title: 'evaluates Succeed.Output when the machine query language is JSONata',
    group,
    tags: ['jsonata', 'succeed', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SuccessState',
      States: {
        SuccessState: {
          Type: 'Succeed',
          Output: {
            status: 'ok',
            requestId: '{% $states.input.requestId %}',
          },
        },
      },
    },
    input: {
      requestId: 'req-succeed-jsonata',
    },
    expected: expectOutput({
      status: 'ok',
      requestId: 'req-succeed-jsonata',
    }),
  }),
  customDefinitionCase({
    id: '002-fail-error-and-cause-jsonata',
    title: 'evaluates Fail.Error and Fail.Cause from JSONata strings',
    group,
    tags: ['jsonata', 'fail', 'error', 'cause'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Error: '{% $states.input.Error %}',
          Cause: '{% $states.input.Cause %}',
        },
      },
    },
    input: {
      Error: 'DynamicJsonataError',
      Cause: 'dynamic fail cause',
    },
    expected: expectFailure('DynamicJsonataError', 'dynamic fail cause'),
  }),
  customDefinitionCase({
    id: '003-state-level-querylanguage-overrides-machine-default',
    title: 'allows a Fail state to override the machine query language to JSONata',
    group,
    tags: ['jsonata', 'fail', 'query_language_override'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          QueryLanguage: 'JSONata',
          Error: '{% $states.input.Error %}',
          Cause: '{% $states.input.Cause %}',
        },
      },
    },
    input: {
      Error: 'OverrideJsonataError',
      Cause: 'override fail cause',
    },
    expected: expectFailure('OverrideJsonataError', 'override fail cause'),
  }),
  customDefinitionCase({
    id: '004-fail-error-only-jsonata',
    title: 'allows a JSONata Fail state with Error only',
    group,
    tags: ['jsonata', 'fail', 'error'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Error: '{% $states.input.Error %}',
        },
      },
    },
    input: {
      Error: 'ErrorOnlyJsonataFail',
    },
    expected: expectFailure('ErrorOnlyJsonataFail', 'FAILED'),
  }),
];
