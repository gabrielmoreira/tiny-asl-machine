import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONataValidation';
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';
const awsStsGetCallerIdentityResource = 'arn:aws:states:::aws-sdk:sts:getCallerIdentity';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

function asDefinition(definition: unknown): ConformanceCase['definition'] {
  return definition as ConformanceCase['definition'];
}

export const featureJsonataValidationCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-same-state-assign-output-sees-entry-value-not-new-value',
    title:
      'same-state JSONata Output sees the state-entry variable value, not the freshly assigned one',
    group,
    tags: ['jsonata', 'assign', 'output', 'parallelism'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          Assign: {
            x: 'outer',
          },
          Next: 'ReassignAndObserve',
        },
        ReassignAndObserve: {
          Type: 'Pass',
          Assign: {
            x: 'fresh',
          },
          Output: '{% $x %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput('outer'),
  }),
  customDefinitionCase({
    id: '002-pass-output-cannot-access-states-result',
    title: 'Pass state Output cannot access $states.result',
    group,
    tags: ['jsonata', 'validation', 'states.result', 'pass'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'InvalidPass',
      States: {
        InvalidPass: {
          Type: 'Pass',
          Output: '{% $states.result %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '003-pass-output-cannot-access-states-erroroutput',
    title: 'Pass state Output cannot access $states.errorOutput',
    group,
    tags: ['jsonata', 'validation', 'states.errorOutput', 'pass'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'InvalidPass',
      States: {
        InvalidPass: {
          Type: 'Pass',
          Output: '{% $states.errorOutput %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '004-task-arguments-cannot-access-states-erroroutput-outside-catch',
    title: 'Task Arguments cannot access $states.errorOutput outside a Catch context',
    group,
    tags: ['jsonata', 'validation', 'states.errorOutput', 'task', 'arguments'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'InvalidTask',
      States: {
        InvalidTask: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: '{% $states.errorOutput %}',
          },
          End: true,
        },
      },
    },
    input: {},
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: (payload: unknown) => payload,
    }),
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '005-catch-output-can-access-states-erroroutput',
    title: 'Catch Output can access $states.errorOutput',
    group,
    tags: ['jsonata', 'validation', 'states.errorOutput', 'catch'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: '{% $states.input %}',
          },
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              Output: '{% $states.errorOutput.Error %}',
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
    input: { requestId: 'req-jsonata-catch-access' },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: () => {
        throw new Error('boom');
      },
    }),
    source: {
      file: 'src/states/index.ts',
      notes:
        "The catcher reads $states.errorOutput.Error, so the expected value is the thrown error name ('Error'), not the message ('boom').",
    },
    expected: expectOutput('Error'),
  }),
  customDefinitionCase({
    id: '006-timeoutseconds-jsonata-valid-integer',
    title: 'Task TimeoutSeconds accepts a valid JSONata integer expression',
    group,
    tags: ['jsonata', 'timeoutseconds', 'task'],
    definition: asDefinition({
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          TimeoutSeconds: '{% $states.input.timeout %}',
          Arguments: {},
          Output: '{% {"ok": true, "timeout": $states.input.timeout} %}',
          End: true,
        },
      },
    }),
    input: { timeout: 3 },
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({ Account: '000000000000' }),
    }),
    expected: expectOutput({ ok: true, timeout: 3 }),
  }),
  customDefinitionCase({
    id: '007-timeoutseconds-jsonata-string-fails',
    title: 'Task TimeoutSeconds rejects a JSONata expression that returns a string',
    group,
    tags: ['jsonata', 'timeoutseconds', 'task', 'negative'],
    definition: asDefinition({
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          TimeoutSeconds: '{% "3" %}',
          Arguments: {},
          End: true,
        },
      },
    }),
    input: {},
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({ Account: '000000000000' }),
    }),
    expected: expectFailure(),
  }),
  customDefinitionCase({
    id: '008-timeoutseconds-jsonata-negative-fails',
    title: 'Task TimeoutSeconds rejects a negative JSONata value',
    group,
    tags: ['jsonata', 'timeoutseconds', 'task', 'negative'],
    definition: asDefinition({
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          TimeoutSeconds: '{% -1 %}',
          Arguments: {},
          End: true,
        },
      },
    }),
    input: {},
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({ Account: '000000000000' }),
    }),
    expected: expectFailure(),
  }),
  customDefinitionCase({
    id: '009-timeoutseconds-jsonata-undefined-fails',
    title: 'Task TimeoutSeconds rejects a JSONata expression that evaluates to undefined',
    group,
    tags: ['jsonata', 'timeoutseconds', 'task', 'undefined'],
    definition: asDefinition({
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          TimeoutSeconds: '{% $states.input.missing %}',
          Arguments: {},
          End: true,
        },
      },
    }),
    input: {},
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({ Account: '000000000000' }),
    }),
    expected: expectFailure(),
  }),
  customDefinitionCase({
    id: '010-timeoutseconds-jsonata-decimal-behavior',
    title: 'Task TimeoutSeconds with a decimal JSONata value follows the AWS-observed behavior',
    group,
    tags: ['jsonata', 'timeoutseconds', 'task', 'aws_observation'],
    definition: asDefinition({
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          TimeoutSeconds: '{% 1.6 %}',
          Arguments: {},
          Output: '{% {"ok": true} %}',
          End: true,
        },
      },
    }),
    input: {},
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({ Account: '000000000000' }),
    }),
    expected: expectFailure(),
  }),
];
