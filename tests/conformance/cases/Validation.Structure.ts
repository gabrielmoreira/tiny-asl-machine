import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Validation.Structure';
const awsStsGetCallerIdentityResource = 'arn:aws:states:::aws-sdk:sts:getCallerIdentity';

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const validationStructureCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-missing-terminal-state-fails-validation',
    title: 'fails validation when no terminal state is reachable',
    group,
    tags: ['validation', 'structure', 'terminal_state'],
    definition: {
      StartAt: 'First',
      States: {
        First: {
          Type: 'Pass',
          Next: 'Second',
        },
        Second: {
          Type: 'Pass',
          Next: 'First',
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '002-missing-next-target-fails-validation',
    title: 'fails validation when a Next target does not exist',
    group,
    tags: ['validation', 'structure', 'missing_target'],
    definition: {
      StartAt: 'First',
      States: {
        First: {
          Type: 'Pass',
          Next: 'MissingState',
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '003-unreachable-state-fails-validation',
    title: 'fails validation when a state is unreachable from StartAt',
    group,
    tags: ['validation', 'structure', 'unreachable_state'],
    definition: {
      StartAt: 'First',
      States: {
        First: {
          Type: 'Pass',
          End: true,
        },
        Unreachable: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '004-states-all-must-appear-alone-in-retry',
    title: 'fails validation when States.ALL is combined with other Retry errors',
    group,
    tags: ['validation', 'structure', 'retry', 'states_all'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          Parameters: {},
          Retry: [
            {
              ErrorEquals: ['States.ALL', 'CustomError'],
              MaxAttempts: 1,
            },
          ],
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '005-states-all-must-appear-last-in-retry',
    title: 'fails validation when States.ALL is not the last Retry catcher',
    group,
    tags: ['validation', 'structure', 'retry', 'states_all'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          Parameters: {},
          Retry: [
            {
              ErrorEquals: ['States.ALL'],
              MaxAttempts: 1,
            },
            {
              ErrorEquals: ['CustomError'],
              MaxAttempts: 1,
            },
          ],
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '006-states-all-must-appear-alone-in-catch',
    title: 'fails validation when States.ALL is combined with other Catch errors',
    group,
    tags: ['validation', 'structure', 'catch', 'states_all'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          Parameters: {},
          Catch: [
            {
              ErrorEquals: ['States.ALL', 'CustomError'],
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '007-states-all-must-appear-last-in-catch',
    title: 'fails validation when States.ALL is not the last Catch entry',
    group,
    tags: ['validation', 'structure', 'catch', 'states_all'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          Parameters: {},
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              Next: 'Recovered',
            },
            {
              ErrorEquals: ['CustomError'],
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
];
