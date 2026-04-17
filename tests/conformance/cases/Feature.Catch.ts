import { expect } from 'vite-plus/test';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.Catch';
const sourceFile = 'src/states/index.spec.ts';
const localExactMatchResource = 'local:feature:catch:exact-match';
const localInjectedErrorResource = 'local:feature:catch:inject-error';
const localNullResultPathResource = 'local:feature:catch:null-resultpath';
const localFirstMatchWinsResource = 'local:feature:catch:first-match-wins';
const awsObservationFailingResource = 'arn:aws:states:::aws-sdk:s3:headBucket';
const awsObservationFailingParameters = {
  Bucket: 'tiny-asl-machine-observation-bucket-should-not-exist',
};

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectOutputShape(shape: Record<string, unknown>): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toMatchObject(shape);
  };
}

function expectFailure(error: string, causeIncludes: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
    expect(result.cause).toContain(causeIncludes);
  };
}

export const featureCatchCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-exact-error-match-routes-recovery',
    title: 'exact error match routes to the matching recovery state',
    group,
    tags: ['error_handling', 'catch', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses local task-style resource mocks so the catalog can isolate Catch routing semantics without external integrations.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localExactMatchResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              Next: 'WrongRecovery',
            },
            {
              ErrorEquals: ['OrderNotFound'],
              Next: 'RecoverExactMatch',
            },
          ],
          End: true,
        },
        WrongRecovery: {
          Type: 'Pass',
          Result: {
            route: 'wrong',
          },
          End: true,
        },
        RecoverExactMatch: {
          Type: 'Pass',
          Result: {
            route: 'exact',
          },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: {
      orderId: 'ord-7',
    },
    setupLocalResources: () => ({
      [localExactMatchResource]: payload => {
        const { orderId } = payload as { orderId: string };
        throw new ExecutionError('OrderNotFound', `missing order ${orderId}`);
      },
    }),
    expected: expectOutput({
      Error: 'OrderNotFound',
      Cause: 'missing order ord-7',
      recovery: {
        route: 'exact',
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps the recovery input as the execution error object so the assertion stays focused on exact ErrorEquals routing.',
    },
  }),
  customDefinitionCase({
    id: '002-catch-resultpath-injects-error-and-cause',
    title: 'Catch ResultPath injects the { Error, Cause } object into the selected path',
    group,
    tags: ['error_handling', 'catch', 'result_path', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses local task-style resource mocks so the catalog can assert Catch ResultPath shaping deterministically.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              ResultPath: '$.taskError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: {
            recovered: true,
          },
          ResultPath: '$.status',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-22',
      payload: {
        customerId: null,
        amount: 25,
      },
    },
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectOutput({
      requestId: 'req-22',
      payload: {
        customerId: null,
        amount: 25,
      },
      taskError: {
        Error: 'ValidationError',
        Cause: 'payload missing customerId',
      },
      status: {
        recovered: true,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Mirrors the existing Task catch example while asserting the injected error envelope as a first-class feature-semantic output.',
    },
  }),
  customDefinitionCase({
    id: '003-catch-resultpath-null-preserves-input',
    title: 'preserves the original input when Catch ResultPath is null',
    group,
    tags: ['error_handling', 'catch', 'result_path', 'local_only'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localNullResultPathResource,
          Catch: [
            {
              ErrorEquals: ['TransientError'],
              ResultPath: null,
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: {
            recovered: true,
          },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: {
      jobId: 'job-44',
      payload: {
        step: 'charge',
      },
    },
    setupLocalResources: () => ({
      [localNullResultPathResource]: () => {
        throw new ExecutionError('TransientError', 'temporary upstream outage');
      },
    }),
    expected: expectOutput({
      jobId: 'job-44',
      payload: {
        step: 'charge',
      },
      recovery: {
        recovered: true,
      },
    }),
    notes:
      'Local runtime now matches the observed AWS behavior: Catch.ResultPath null preserves the original input and does not inject the error envelope.',
    source: {
      file: sourceFile,
      notes:
        'Local parity coverage for Catch.ResultPath null after aligning the runtime with the AWS observation.',
    },
  }),
  customDefinitionCase({
    id: '004-first-matching-catcher-wins',
    title: 'the first matching catcher wins when multiple catchers match the same error',
    group,
    tags: ['error_handling', 'catch', 'ordering', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses local task-style resource mocks so the catalog can assert catcher ordering directly and deterministically.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localFirstMatchWinsResource,
          Catch: [
            {
              ErrorEquals: ['DuplicateError'],
              ResultPath: '$.firstError',
              Next: 'RecoveredByFirst',
            },
            {
              ErrorEquals: ['DuplicateError'],
              ResultPath: '$.secondError',
              Next: 'RecoveredBySecond',
            },
          ],
          End: true,
        },
        RecoveredByFirst: {
          Type: 'Pass',
          Result: {
            winner: 'first',
          },
          ResultPath: '$.resolution',
          End: true,
        },
        RecoveredBySecond: {
          Type: 'Pass',
          Result: {
            winner: 'second',
          },
          ResultPath: '$.resolution',
          End: true,
        },
      },
    },
    input: {
      jobId: 'job-13',
      stage: 'dispatch',
    },
    setupLocalResources: () => ({
      [localFirstMatchWinsResource]: () => {
        throw new ExecutionError('DuplicateError', 'both catchers match this error');
      },
    }),
    expected: expectOutput({
      jobId: 'job-13',
      stage: 'dispatch',
      firstError: {
        Error: 'DuplicateError',
        Cause: 'both catchers match this error',
      },
      resolution: {
        winner: 'first',
      },
    }),
    notes:
      'Uses two exact-match catchers instead of wildcard aliases so the case stays within clearly readable, declaration-order semantics.',
    source: {
      file: sourceFile,
      notes:
        'Complements the direct catch example by asserting that catcher selection is stable and order-sensitive when more than one catcher can match.',
    },
  }),
  customDefinitionCase({
    id: '008-jsonata-catcher-output-merges-input-and-error',
    title: 'JSONata catcher Output can merge $states.input with $states.errorOutput',
    description:
      'Dual-run parity case: Catch uses JSONata Output to merge the original input and the generated error output before transitioning to recovery.',
    group,
    tags: ['catch', 'jsonata', 'error_output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'InvokeMissingService',
      States: {
        InvokeMissingService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Arguments: awsObservationFailingParameters,
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              Output: '{% $merge([$states.input, {"error-info": $states.errorOutput}]) %}',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Output: '{% $merge([$states.input, {"recovery": {"recovered": true}}]) %}',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-jsonata-catch',
      keep: 'value',
    },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError(
          'SyntheticJsonataCatchError',
          'local jsonata catcher output failure'
        );
      },
    }),
    expected: expectOutputShape({
      requestId: 'req-jsonata-catch',
      keep: 'value',
      'error-info': {
        Error: expect.any(String),
        Cause: expect.any(String),
      },
      recovery: {
        recovered: true,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Exercises JSONata Catch Output with $states.input and $states.errorOutput in both local and AWS-backed execution paths.',
    },
  }),
  customDefinitionCase({
    id: '005-aws-observe-catch-taskfailed-matches-custom-error',
    title: 'observes whether States.TaskFailed catches a custom AWS SDK task failure',
    description:
      'AWS-first observation case: the Task intentionally fails using an unsupported service integration, and the machine records whether a catcher with ErrorEquals ["States.TaskFailed"] recovers.',
    group,
    tags: ['aws_observation', 'catch', 'task_failed'],
    definition: {
      StartAt: 'InvokeMissingService',
      States: {
        InvokeMissingService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Catch: [
            {
              ErrorEquals: ['States.TaskFailed'],
              ResultPath: '$.caught',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { recovered: true },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: { probe: 'taskfailed' },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError('S3.NoSuchBucketException', 'local observation failure');
      },
    }),
    awsObservation: { includeExecutionHistory: true },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toEqual(
        expect.objectContaining({
          caught: {
            Error: expect.any(String),
            Cause: expect.any(String),
          },
          recovery: { recovered: true },
        })
      );
      if (result.meta) {
        expect(result.meta.history).toEqual(expect.any(Array));
      }
    },
    source: {
      file: sourceFile,
      notes:
        'Designed to discover whether AWS reserves States.TaskFailed as a broad alias for failing service integrations before local Catch semantics are corrected.',
    },
  }),
  customDefinitionCase({
    id: '006-aws-observe-catch-resultpath-null',
    title: 'observes AWS behavior for Catch ResultPath set to null',
    description:
      'AWS-first observation case: if the Task fails and Catch.ResultPath is explicitly null, this records whether AWS preserves the original input before the recovery state runs.',
    group,
    tags: ['aws_observation', 'catch', 'result_path'],
    definition: {
      StartAt: 'InvokeMissingService',
      States: {
        InvokeMissingService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: null,
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { recovered: true },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: { requestId: 'req-catch-null', keep: { marker: 'original' } },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError('SyntheticNullResultPathError', 'local observation failure');
      },
    }),
    awsObservation: { includeExecutionHistory: true },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toEqual(
        expect.objectContaining({
          requestId: 'req-catch-null',
          keep: { marker: 'original' },
          recovery: { recovered: true },
        })
      );
      if (result.meta) {
        expect(result.meta.history).toEqual(expect.any(Array));
      }
    },
    source: {
      file: sourceFile,
      notes:
        'This case exists specifically to replace the current local caveat with an AWS-observed source of truth before changing Catch.ResultPath null handling in the runtime.',
    },
  }),
  customDefinitionCase({
    id: '007-aws-observe-catcher-ordering',
    title: 'observes whether AWS chooses the first matching catcher',
    description:
      'AWS-first observation case: the first catcher matches the exact observed AWS SDK task error name and the second is States.ALL, so recovery proves whether AWS honors declaration order when both could apply.',
    group,
    tags: ['aws_observation', 'catch', 'ordering'],
    definition: {
      StartAt: 'InvokeMissingService',
      States: {
        InvokeMissingService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Catch: [
            {
              ErrorEquals: ['S3.NoSuchBucketException'],
              ResultPath: '$.firstError',
              Next: 'RecoveredByFirst',
            },
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.secondError',
              Next: 'RecoveredBySecond',
            },
          ],
          End: true,
        },
        RecoveredByFirst: {
          Type: 'Pass',
          Result: { winner: 'first' },
          ResultPath: '$.resolution',
          End: true,
        },
        RecoveredBySecond: {
          Type: 'Pass',
          Result: { winner: 'second' },
          ResultPath: '$.resolution',
          End: true,
        },
      },
    },
    input: { requestId: 'req-catch-order' },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError('S3.NoSuchBucketException', 'local observation failure');
      },
    }),
    awsObservation: { includeExecutionHistory: true },
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toEqual(
        expect.objectContaining({
          resolution: { winner: 'first' },
          firstError: {
            Error: expect.any(String),
            Cause: expect.any(String),
          },
        })
      );
      expect(result.output).not.toHaveProperty('secondError');
      if (result.meta) {
        expect(result.meta.history).toEqual(expect.any(Array));
      }
    },
    source: {
      file: sourceFile,
      notes:
        'This AWS observation will anchor catcher ordering semantics before local Catch matcher cleanup.',
    },
  }),
  customDefinitionCase({
    id: '009-catch-resultpath-invalid-target-fails-with-resultpathmatchfailure',
    title:
      'Catch ResultPath fails with States.ResultPathMatchFailure when applied to a non-object input',
    group,
    tags: ['error_handling', 'catch', 'result_path', 'negative', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Pins local behavior for invalid Catch.ResultPath application before AWS wording is captured for this exact shape.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              ResultPath: '$.taskError',
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
    input: 'not-an-object',
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectFailure('States.ResultPathMatchFailure', '$.taskError'),
  }),
  customDefinitionCase({
    id: '010-catch-resultpath-literal-takes-precedence-over-output',
    title: 'JSONPath Catch ResultPath wins over Output when both fields are present',
    group,
    tags: ['error_handling', 'catch', 'precedence', 'local_only'],
    awsExecutable: false,
    skipReason:
      'JSONPath Catchers should use ResultPath semantics; Output is a JSONata-only surface and this local regression test pins the current precedence explicitly.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              ResultPath: '$.taskError',
              Output: '{% {"should": "be ignored"} %}',
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
    } as unknown as ConformanceCase['definition'],
    input: {
      requestId: 'req-catch-precedence',
    },
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectOutput({
      requestId: 'req-catch-precedence',
      taskError: {
        Error: 'ValidationError',
        Cause: 'payload missing customerId',
      },
    }),
  }),
  customDefinitionCase({
    id: '011-catch-resultpath-invalid-syntax-fails-with-resultpathmatchfailure',
    title:
      'Catch ResultPath fails with States.ResultPathMatchFailure when the path syntax is invalid',
    group,
    tags: ['error_handling', 'catch', 'result_path', 'negative', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Pins local behavior for malformed Catch.ResultPath syntax before AWS wording is captured for this exact shape.',
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              ResultPath: 'not-a-path',
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
    input: {
      requestId: 'req-catch-invalid-resultpath',
    },
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectFailure('States.ResultPathMatchFailure', 'not-a-path'),
  }),
  customDefinitionCase({
    id: '012-jsonata-catch-output-takes-precedence-over-resultpath',
    title:
      'JSONata Catch Output takes precedence over an invalid ResultPath field if both are present',
    group,
    tags: ['error_handling', 'catch', 'jsonata', 'precedence', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Pins local/runtime precedence behavior for a malformed mixed-surface catcher object; ResultPath is not a JSONata Catcher field in the spec.',
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              Output: '{% {"from": "output", "error": $states.errorOutput.Error} %}',
              ResultPath: 'not-a-path',
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
    } as unknown as ConformanceCase['definition'],
    input: {
      requestId: 'req-jsonata-catch-precedence',
    },
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectOutput({
      from: 'output',
      error: 'ValidationError',
    }),
  }),
  customDefinitionCase({
    id: '013-jsonata-catch-output-invalid-expression-fails',
    title: 'JSONata Catch Output fails when the output expression is invalid',
    group,
    tags: ['error_handling', 'catch', 'jsonata', 'negative', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Pins local/runtime behavior for an invalid JSONata Catch.Output expression before AWS wording is captured for this exact shape.',
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localInjectedErrorResource,
          Catch: [
            {
              ErrorEquals: ['ValidationError'],
              Output: '{% $doesNotParse( %}',
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
    input: {
      requestId: 'req-jsonata-catch-invalid-output',
    },
    setupLocalResources: () => ({
      [localInjectedErrorResource]: () => {
        throw new ExecutionError('ValidationError', 'payload missing customerId');
      },
    }),
    expected: expectFailure('States.QueryEvaluationError', 'Failed to evaluate JSONata expression'),
  }),
];
