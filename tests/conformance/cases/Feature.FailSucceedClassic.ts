import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.FailSucceedClassic';

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

export const featureFailSucceedClassicCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-fail-error-only-classic',
    title: 'allows a classic Fail state with Error only',
    group,
    tags: ['fail', 'error'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Error: 'ClassicErrorOnly',
        },
      },
    },
    input: {
      requestId: 'req-fail-error-only',
    },
    expected: expectFailure('ClassicErrorOnly', 'FAILED'),
  }),
  customDefinitionCase({
    id: '002-fail-cause-only-classic',
    title: 'allows a classic Fail state with Cause only',
    group,
    tags: ['fail', 'cause'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Cause: 'classic fail cause only',
        },
      },
    },
    input: {
      requestId: 'req-fail-cause-only',
    },
    expected: expectFailure('FAILED', 'classic fail cause only'),
  }),
  customDefinitionCase({
    id: '003-fail-error-and-cause-classic',
    title: 'allows a classic Fail state with both Error and Cause',
    group,
    tags: ['fail', 'error', 'cause'],
    definition: {
      StartAt: 'FailState',
      States: {
        FailState: {
          Type: 'Fail',
          Error: 'ClassicStaticError',
          Cause: 'classic static fail cause',
        },
      },
    },
    input: {
      requestId: 'req-fail-error-cause',
      ignored: true,
    },
    expected: expectFailure('ClassicStaticError', 'classic static fail cause'),
  }),
  customDefinitionCase({
    id: '004-succeed-pass-through-classic',
    title: 'classic Succeed returns its input unchanged and terminates execution',
    group,
    tags: ['succeed', 'pass_through', 'terminal_state'],
    definition: {
      StartAt: 'SuccessState',
      States: {
        SuccessState: {
          Type: 'Succeed',
        },
      },
    },
    input: {
      status: 'ok',
      requestId: 'req-succeed-classic',
      nested: {
        count: 1,
      },
    },
    expected: expectOutput({
      status: 'ok',
      requestId: 'req-succeed-classic',
      nested: {
        count: 1,
      },
    }),
  }),
];
