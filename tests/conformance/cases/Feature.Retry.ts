import { expect } from 'vitest';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.Retry';
const sourceFile = 'src/states/index.ts';
const awsObservationFailingResource = 'arn:aws:states:::aws-sdk:s3:headBucket';
const awsObservationFailingParameters = {
  Bucket: 'tiny-asl-machine-observation-bucket-should-not-exist',
};
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';

const noDelayRuntimeSetup = () => ({
  sleep: async () => undefined,
});

function expectObservedRecovery(
  result: TestResult,
  options: {
    recoveredAt: string;
    originalInput: Record<string, unknown>;
    retriedField?: string;
  }
) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual(
    expect.objectContaining({
      ...options.originalInput,
      recovery: { at: options.recoveredAt },
      ...(options.retriedField
        ? {
            [options.retriedField]: {
              Error: expect.any(String),
              Cause: expect.any(String),
            },
          }
        : {}),
    })
  );

  if (result.meta) {
    expect(result.meta.history).toEqual(expect.any(Array));
  }
}

function expectObservedRetryCount(result: TestResult, expectedRetryCount: number) {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual({
    observedRetryCount: expectedRetryCount,
  });

  if (result.meta) {
    expect(result.meta.history).toEqual(expect.any(Array));
  }
}

export const featureRetryCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-retry-all-then-catch',
    title: 'observes retry exhaustion before Catch recovery with States.ALL',
    description:
      'AWS-first observation case: the task always fails, Retry uses States.ALL with MaxAttempts 2, and Catch should recover only after retries are exhausted.',
    group,
    tags: ['aws_observation', 'retry', 'catch'],
    localExecutable: true,
    definition: {
      StartAt: 'InvokeUnimplementedService',
      States: {
        InvokeUnimplementedService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Retry: [
            {
              ErrorEquals: ['States.ALL'],
              IntervalSeconds: 1,
              MaxAttempts: 2,
              BackoffRate: 2,
            },
          ],
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.retriedError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { at: 'catch-after-retry' },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: { requestId: 'req-retry-1' },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError('SyntheticRetryError', 'local retry observation failure');
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    awsObservation: { includeExecutionHistory: true },
    expected: result =>
      expectObservedRecovery(result, {
        recoveredAt: 'catch-after-retry',
        originalInput: { requestId: 'req-retry-1' },
        retriedField: 'retriedError',
      }),
    source: {
      file: sourceFile,
      notes:
        'Use execution history to count task attempts and confirm Catch runs only after retry exhaustion when AWS is the source of truth.',
    },
  }),
  customDefinitionCase({
    id: '002-retrier-ordering-falls-through',
    title: 'observes retrier ordering when the first retrier does not match',
    description:
      'AWS-first observation case: a non-matching Timeout retrier precedes a States.ALL retrier, allowing history inspection to confirm that retry behavior comes from the later matching entry.',
    group,
    tags: ['aws_observation', 'retry', 'ordering'],
    localExecutable: true,
    definition: {
      StartAt: 'InvokeUnimplementedService',
      States: {
        InvokeUnimplementedService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Retry: [
            {
              ErrorEquals: ['States.Timeout'],
              IntervalSeconds: 1,
              MaxAttempts: 0,
              BackoffRate: 2,
            },
            {
              ErrorEquals: ['States.ALL'],
              IntervalSeconds: 1,
              MaxAttempts: 1,
              BackoffRate: 2,
            },
          ],
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.retriedError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { at: 'ordered-retry-catch' },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: { requestId: 'req-retry-2' },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError(
          'SyntheticRetryOrderingError',
          'local retry ordering observation failure'
        );
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    awsObservation: { includeExecutionHistory: true },
    expected: result =>
      expectObservedRecovery(result, {
        recoveredAt: 'ordered-retry-catch',
        originalInput: { requestId: 'req-retry-2' },
        retriedField: 'retriedError',
      }),
    source: {
      file: sourceFile,
      notes:
        'Execution history should show that the non-matching Timeout retrier is skipped and the later States.ALL retrier controls the retry behavior.',
    },
  }),
  customDefinitionCase({
    id: '003-max-attempts-zero-skips-retry',
    title: 'observes that MaxAttempts zero skips retries and falls directly into Catch',
    description:
      'AWS-first observation case: Retry is configured with MaxAttempts 0, so execution history should show no retry attempts before Catch recovery.',
    group,
    tags: ['aws_observation', 'retry', 'max_attempts'],
    localExecutable: true,
    definition: {
      StartAt: 'InvokeUnimplementedService',
      States: {
        InvokeUnimplementedService: {
          Type: 'Task',
          Resource: awsObservationFailingResource,
          Parameters: awsObservationFailingParameters,
          Retry: [
            {
              ErrorEquals: ['States.ALL'],
              IntervalSeconds: 1,
              MaxAttempts: 0,
              BackoffRate: 2,
            },
          ],
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.retriedError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { at: 'zero-max-attempts' },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: { requestId: 'req-retry-3' },
    setupLocalResources: () => ({
      [awsObservationFailingResource]: () => {
        throw new ExecutionError(
          'SyntheticZeroRetryError',
          'local zero-attempt retry observation failure'
        );
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    awsObservation: { includeExecutionHistory: true },
    expected: result =>
      expectObservedRecovery(result, {
        recoveredAt: 'zero-max-attempts',
        originalInput: { requestId: 'req-retry-3' },
        retriedField: 'retriedError',
      }),
    source: {
      file: sourceFile,
      notes:
        'History should reveal whether MaxAttempts 0 means no retries at all before Catch for this task failure shape.',
    },
  }),
  customDefinitionCase({
    id: '004-retrycount-visible-on-successful-attempt',
    title: 'observes State.RetryCount on the successful retry attempt',
    description:
      'Uses a task that fails until RetryCount reaches 2, proving that the context value observed by the task matches the successful retry attempt.',
    group,
    tags: ['retry', 'context', 'retry_count'],
    definition: {
      StartAt: 'InvokeLambdaLikeTask',
      States: {
        InvokeLambdaLikeTask: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'if (payload.retryCount < 2) throw new Error(`retry-count-${payload.retryCount}`); return { observedRetryCount: payload.retryCount };',
              },
              payload: {
                'retryCount.$': '$$.State.RetryCount',
              },
            },
          },
          ResultSelector: {
            'observedRetryCount.$': '$.Payload.observedRetryCount',
          },
          Retry: [
            {
              ErrorEquals: ['States.ALL'],
              IntervalSeconds: 1,
              MaxAttempts: 2,
              BackoffRate: 2,
            },
          ],
          End: true,
        },
      },
    },
    input: {},
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => {
        const request = payload as { Payload?: { payload?: { retryCount?: number } } };
        const retryCount = request.Payload?.payload?.retryCount ?? -1;
        if (retryCount < 2) {
          throw new ExecutionError('Lambda.AWSLambdaException', `retry-count-${retryCount}`);
        }

        return {
          ExecutedVersion: '$LATEST',
          Payload: {
            observedRetryCount: retryCount,
          },
          SdkHttpMetadata: {
            HttpHeaders: {
              'X-Amz-Executed-Version': '$LATEST',
              'Content-Type': 'application/json',
            },
            HttpStatusCode: 200,
          },
          SdkResponseMetadata: {
            RequestId: 'req-retrycount-local',
          },
          StatusCode: 200,
        };
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    awsObservation: { includeExecutionHistory: true },
    expected: result => expectObservedRetryCount(result, 2),
    source: {
      file: sourceFile,
      notes:
        'Bridges AWS observation and local parity by asserting the successful attempt sees State.RetryCount === 2 after two retries.',
    },
  }),
  (() => {
    const recordedSleeps: number[] = [];
    let attempts = 0;

    return customDefinitionCase({
      id: '005-max-delay-seconds-caps-backoff-delay',
      title: 'MaxDelaySeconds caps exponential backoff between retries',
      group,
      tags: ['retry', 'max_delay', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Asserts local runtime sleep scheduling directly; AWS execution-history timing is too noisy for a deterministic delay-cap assertion here.',
      definition: {
        StartAt: 'FlakyTask',
        States: {
          FlakyTask: {
            Type: 'Task',
            Resource: 'arn:local:retry:max-delay',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 1,
                BackoffRate: 3,
                MaxAttempts: 3,
                MaxDelaySeconds: 2,
              },
            ],
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'arn:local:retry:max-delay': () => {
          attempts += 1;
          if (attempts <= 3) {
            throw new ExecutionError('SyntheticRetryError', `attempt-${attempts}`);
          }

          return {
            ok: true,
            attempts,
          };
        },
      }),
      setupLocalRuntime: () => ({
        sleep: async ms => {
          recordedSleeps.push(ms);
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          ok: true,
          attempts: 4,
        });
        expect(recordedSleeps).toStrictEqual([1000, 2000, 2000]);
      },
      source: {
        file: sourceFile,
        notes:
          'Local-only conformance for Retry.MaxDelaySeconds. Without the cap, the exponential schedule here would be [1000, 3000, 9000].',
      },
    });
  })(),
  (() => {
    const recordedSleeps: number[] = [];
    let attempts = 0;

    return customDefinitionCase({
      id: '006-max-delay-seconds-zero-caps-all-delays-to-zero',
      title: 'MaxDelaySeconds zero caps all retry delays to zero',
      group,
      tags: ['retry', 'max_delay', 'boundary', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Asserts local runtime sleep scheduling directly; AWS execution-history timing is too noisy for a deterministic zero-delay assertion here.',
      definition: {
        StartAt: 'FlakyTask',
        States: {
          FlakyTask: {
            Type: 'Task',
            Resource: 'arn:local:retry:max-delay-zero',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 1,
                BackoffRate: 3,
                MaxAttempts: 2,
                MaxDelaySeconds: 0,
              },
            ],
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'arn:local:retry:max-delay-zero': () => {
          attempts += 1;
          if (attempts <= 2) {
            throw new ExecutionError('SyntheticRetryError', `attempt-${attempts}`);
          }

          return {
            ok: true,
            attempts,
          };
        },
      }),
      setupLocalRuntime: () => ({
        sleep: async ms => {
          recordedSleeps.push(ms);
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          ok: true,
          attempts: 3,
        });
        expect(recordedSleeps).toStrictEqual([0, 0]);
      },
      source: {
        file: sourceFile,
        notes:
          'Boundary conformance for Retry.MaxDelaySeconds = 0. This should clamp the entire retry schedule to zero delay.',
      },
    });
  })(),
  (() => {
    const recordedSleeps: number[] = [];
    const recordedRandomCalls: Array<{ min: number; max: number }> = [];
    let attempts = 0;

    return customDefinitionCase({
      id: '007-jitter-strategy-full-randomizes-delay',
      title: 'JitterStrategy FULL randomizes each retry delay using runtime.random',
      group,
      tags: ['retry', 'jitter', 'local_only'],
      awsExecutable: false,
      skipReason:
        'The ASL spec leaves JitterStrategy interpreter-defined, so this case pins the local runtime semantics for the FULL strategy.',
      definition: {
        StartAt: 'FlakyTask',
        States: {
          FlakyTask: {
            Type: 'Task',
            Resource: 'arn:local:retry:jitter-full',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 1,
                BackoffRate: 2,
                MaxAttempts: 2,
                JitterStrategy: 'FULL',
              },
            ],
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'arn:local:retry:jitter-full': () => {
          attempts += 1;
          if (attempts <= 2) {
            throw new ExecutionError('SyntheticRetryError', `attempt-${attempts}`);
          }

          return {
            ok: true,
            attempts,
          };
        },
      }),
      setupLocalRuntime: () => ({
        sleep: async ms => {
          recordedSleeps.push(ms);
        },
        random: (min, max) => {
          recordedRandomCalls.push({ min, max });
          return 17;
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          ok: true,
          attempts: 3,
        });
        expect(recordedRandomCalls).toStrictEqual([
          { min: 0, max: 1001 },
          { min: 0, max: 2001 },
        ]);
        expect(recordedSleeps).toStrictEqual([17, 17]);
      },
      source: {
        file: sourceFile,
        notes:
          'Pins the interpreter-defined FULL jitter semantics to runtime.random(0, baseDelayMs + 1). Without JitterStrategy support, this case will sleep [1000, 2000] and never call random.',
      },
    });
  })(),
  (() => {
    const recordedSleeps: number[] = [];
    const recordedRandomCalls: Array<{ min: number; max: number }> = [];
    let attempts = 0;

    return customDefinitionCase({
      id: '008-jitter-full-respects-max-delay-cap',
      title: 'JitterStrategy FULL applies after MaxDelaySeconds capping',
      group,
      tags: ['retry', 'jitter', 'max_delay', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Pins the local interpreter semantics for combining FULL jitter with MaxDelaySeconds.',
      definition: {
        StartAt: 'FlakyTask',
        States: {
          FlakyTask: {
            Type: 'Task',
            Resource: 'arn:local:retry:jitter-full-capped',
            Retry: [
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 1,
                BackoffRate: 2,
                MaxAttempts: 2,
                MaxDelaySeconds: 1,
                JitterStrategy: 'FULL',
              },
            ],
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'arn:local:retry:jitter-full-capped': () => {
          attempts += 1;
          if (attempts <= 2) {
            throw new ExecutionError('SyntheticRetryError', `attempt-${attempts}`);
          }

          return {
            ok: true,
            attempts,
          };
        },
      }),
      setupLocalRuntime: () => ({
        sleep: async ms => {
          recordedSleeps.push(ms);
        },
        random: (min, max) => {
          recordedRandomCalls.push({ min, max });
          return 11;
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          ok: true,
          attempts: 3,
        });
        expect(recordedRandomCalls).toStrictEqual([
          { min: 0, max: 1001 },
          { min: 0, max: 1001 },
        ]);
        expect(recordedSleeps).toStrictEqual([11, 11]);
      },
      source: {
        file: sourceFile,
        notes:
          'Regression guard: MaxDelaySeconds must cap the exponential delay before FULL jitter computes its random range.',
      },
    });
  })(),
  (() => {
    const recordedSleeps: number[] = [];
    let attempts = 0;
    let phase: 'timeout' | 'all' = 'timeout';

    return customDefinitionCase({
      id: '009-retry-attempts-are-tracked-per-matched-retrier',
      title:
        'retry attempts are tracked per matched retrier rather than globally across different retriers',
      group,
      tags: ['retry', 'ordering', 'per_retrier', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Regression guard for local retry bookkeeping when the matched retrier changes between attempts.',
      definition: {
        StartAt: 'FlakyTask',
        States: {
          FlakyTask: {
            Type: 'Task',
            Resource: 'arn:local:retry:per-retrier-accounting',
            Retry: [
              {
                ErrorEquals: ['States.Timeout'],
                IntervalSeconds: 1,
                MaxAttempts: 1,
              },
              {
                ErrorEquals: ['States.ALL'],
                IntervalSeconds: 1,
                MaxAttempts: 1,
              },
            ],
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'arn:local:retry:per-retrier-accounting': () => {
          attempts += 1;
          if (phase === 'timeout') {
            phase = 'all';
            throw new ExecutionError('States.Timeout', `timeout-${attempts}`);
          }
          if (attempts === 2) {
            throw new ExecutionError('SyntheticRetryError', `all-${attempts}`);
          }
          return { ok: true, attempts };
        },
      }),
      setupLocalRuntime: () => ({
        sleep: async ms => {
          recordedSleeps.push(ms);
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({ ok: true, attempts: 3 });
        expect(recordedSleeps).toStrictEqual([1000, 1000]);
      },
      source: {
        file: sourceFile,
        notes:
          'If retry attempts are tracked globally instead of per matched retrier, the second retrier will be skipped after the Timeout retry is consumed and this case will fail.',
      },
    });
  })(),
];
