import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONataErrors';
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectQueryEvaluationError(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('States.QueryEvaluationError');
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const featureJsonataErrorsCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-undefined-path-access-throws-query-evaluation-error',
    title: 'accessing a nonexistent path returns undefined and throws States.QueryEvaluationError',
    group,
    tags: ['jsonata', 'errors', 'undefined', 'query_evaluation_error'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $states.input.doesNotExist %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectQueryEvaluationError(),
  }),

  customDefinitionCase({
    id: '002-arithmetic-type-error-throws-query-evaluation-error',
    title: 'adding a string and a number in JSONata throws States.QueryEvaluationError',
    group,
    tags: ['jsonata', 'errors', 'type_error', 'query_evaluation_error'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $states.input.str + $states.input.num %}',
          End: true,
        },
      },
    },
    input: { str: 'hello', num: 5 },
    expected: expectQueryEvaluationError(),
  }),

  customDefinitionCase({
    id: '003-catch-catches-query-evaluation-error-from-arguments',
    title: 'Catch clause catches States.QueryEvaluationError raised during Arguments evaluation',
    group,
    tags: ['jsonata', 'errors', 'catch', 'arguments', 'query_evaluation_error'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: '{% $states.input.num + $states.input.str %}',
          },
          Catch: [
            {
              ErrorEquals: ['States.QueryEvaluationError'],
              Output: {
                caught: true,
                requestId: '{% $states.input.requestId %}',
              },
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
    input: { num: 42, str: 'not-a-number', requestId: 'req-catch-qee' },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: (payload: unknown) => payload,
    }),
    expected: expectOutput({
      caught: true,
      requestId: 'req-catch-qee',
    }),
  }),
];
