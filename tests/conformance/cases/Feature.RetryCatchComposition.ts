import { expect } from 'vitest';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.RetryCatchComposition';
const sourceFile = 'src/states/index.ts';
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';

const noDelayRuntimeSetup = () => ({
  sleep: async () => undefined,
});

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

function buildLambdaInvokeResponse(payload: Record<string, unknown>) {
  return {
    ExecutedVersion: '$LATEST',
    Payload: payload,
    SdkHttpMetadata: {
      HttpHeaders: {
        'X-Amz-Executed-Version': '$LATEST',
        'Content-Type': 'application/json',
      },
      HttpStatusCode: 200,
    },
    SdkResponseMetadata: {
      RequestId: 'req-retry-catch-composition-local',
    },
    StatusCode: 200,
  };
}

export const featureRetryCatchCompositionCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-retried-error-eventually-succeeds-without-catch',
    title: 'retried error eventually succeeds and Catch does not run',
    description:
      'AWS-first parity case: a Lambda-style task fails until State.RetryCount reaches 2, proving success short-circuits the Catch path.',
    group,
    tags: ['retry', 'catch', 'composition'],
    definition: {
      StartAt: 'InvokeFixture',
      States: {
        InvokeFixture: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'if (payload.retryCount < 2) throw new Error(`retry-${payload.retryCount}`); return { ok: true, observedRetryCount: payload.retryCount };',
              },
              payload: {
                'retryCount.$': '$$.State.RetryCount',
              },
            },
          },
          ResultSelector: {
            'ok.$': '$.Payload.ok',
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
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.caught',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { reached: 'catch' },
          ResultPath: '$.recovery',
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
          throw new ExecutionError('Lambda.AWSLambdaException', `retry-${retryCount}`);
        }

        return buildLambdaInvokeResponse({
          ok: true,
          observedRetryCount: retryCount,
        });
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    expected: expectOutput({
      ok: true,
      observedRetryCount: 2,
    }),
    source: {
      file: sourceFile,
      notes:
        'Extends the existing RetryCount coverage into retry/catch composition by proving that a successful retry attempt terminates the state before Catch evaluation.',
    },
  }),
  customDefinitionCase({
    id: '002-retries-exhaust-before-catch-recovery',
    title: 'retries exhaust and Catch runs afterward',
    description:
      'AWS-first parity case: the task always fails, Retry exhausts, and Catch captures the final task failure envelope before recovery.',
    group,
    tags: ['retry', 'catch', 'composition', 'result_path'],
    definition: {
      StartAt: 'InvokeFixture',
      States: {
        InvokeFixture: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'throw new Error(`exhausted-${payload.requestId}`);',
              },
              payload: {
                'requestId.$': '$.requestId',
              },
            },
          },
          Retry: [
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
          Result: { status: 'caught-after-exhaustion' },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-retry-catch-2',
      job: { id: 'job-2' },
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => {
        const request = payload as { Payload?: { payload?: { requestId?: string } } };
        const requestId = request.Payload?.payload?.requestId ?? 'missing-request';
        throw new ExecutionError('Lambda.AWSLambdaException', `exhausted-${requestId}`);
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    expected: expectOutputShape({
      requestId: 'req-retry-catch-2',
      job: { id: 'job-2' },
      retriedError: {
        Error: expect.any(String),
        Cause: expect.any(String),
      },
      recovery: {
        status: 'caught-after-exhaustion',
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Pins the handoff point between Retry exhaustion and Catch recovery without depending on exact AWS failure text.',
    },
  }),
  (() => {
    let attempts = 0;

    return customDefinitionCase({
      id: '003-non-retried-error-goes-straight-to-catch',
      title: 'one error type is retried while another goes straight to Catch',
      group,
      tags: ['retry', 'catch', 'composition', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Uses a stateful local stub to drive a deterministic multi-error sequence across attempts.',
      definition: {
        StartAt: 'InvokeTask',
        States: {
          InvokeTask: {
            Type: 'Task',
            Resource: 'local:feature:retry-catch:mixed-errors',
            Retry: [
              {
                ErrorEquals: ['TransientError'],
                IntervalSeconds: 1,
                MaxAttempts: 2,
                BackoffRate: 2,
              },
            ],
            Catch: [
              {
                ErrorEquals: ['ValidationError'],
                ResultPath: '$.caught',
                Next: 'Recovered',
              },
            ],
            End: true,
          },
          Recovered: {
            Type: 'Pass',
            Result: { path: 'validation-catch' },
            ResultPath: '$.recovery',
            End: true,
          },
        },
      },
      input: {
        requestId: 'req-retry-catch-3',
      },
      setupLocalResources: () => ({
        'local:feature:retry-catch:mixed-errors': () => {
          attempts += 1;

          if (attempts === 1) {
            throw new ExecutionError('TransientError', 'retry-me-first');
          }

          throw new ExecutionError('ValidationError', 'go-straight-to-catch');
        },
      }),
      setupLocalRuntime: noDelayRuntimeSetup,
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          requestId: 'req-retry-catch-3',
          caught: {
            Error: 'ValidationError',
            Cause: 'go-straight-to-catch',
          },
          recovery: {
            path: 'validation-catch',
          },
        });
        expect(attempts).toBe(2);
      },
      source: {
        file: sourceFile,
        notes:
          'Composition coverage for the common "retry transients, catch business errors" pattern with an explicit two-attempt sequence.',
      },
    });
  })(),
  customDefinitionCase({
    id: '004-catch-resultpath-preserves-structured-error-after-retry',
    title: 'catcher ResultPath preserves structured error output after retry exhaustion',
    description:
      'AWS-first parity case: after Retry exhausts, Catch injects the final { Error, Cause } object into a nested container while preserving sibling input.',
    group,
    tags: ['retry', 'catch', 'composition', 'result_path'],
    definition: {
      StartAt: 'InvokeFixture',
      States: {
        InvokeFixture: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'throw new Error(`downstream-${payload.orderId}`);',
              },
              payload: {
                'orderId.$': '$.order.id',
              },
            },
          },
          Retry: [
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
              ResultPath: '$.diagnostics.lastError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: { handled: true },
          ResultPath: '$.diagnostics.recovery',
          End: true,
        },
      },
    },
    input: {
      order: { id: 'ord-9' },
      diagnostics: {
        previous: 'keep-me',
      },
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => {
        const request = payload as { Payload?: { payload?: { orderId?: string } } };
        const orderId = request.Payload?.payload?.orderId ?? 'missing-order';
        throw new ExecutionError('Lambda.AWSLambdaException', `downstream-${orderId}`);
      },
    }),
    setupLocalRuntime: noDelayRuntimeSetup,
    expected: expectOutputShape({
      order: { id: 'ord-9' },
      diagnostics: {
        previous: 'keep-me',
        lastError: {
          Error: expect.any(String),
          Cause: expect.any(String),
        },
        recovery: {
          handled: true,
        },
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Focuses on nested Catch.ResultPath shaping after Retry exhaustion rather than on exact provider-specific error strings.',
    },
  }),
  (() => {
    let attempts = 0;

    return customDefinitionCase({
      id: '005-inner-task-recovery-allows-outer-flow-to-continue',
      title: 'a task in a larger machine uses Retry/Catch while the outer flow continues',
      group,
      tags: ['retry', 'catch', 'composition', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Uses a local stateful task stub so the workflow can deterministically assert retry exhaustion plus downstream continuation.',
      definition: {
        StartAt: 'Seed',
        States: {
          Seed: {
            Type: 'Pass',
            Result: { seeded: true },
            ResultPath: '$.meta',
            Next: 'InvokeTask',
          },
          InvokeTask: {
            Type: 'Task',
            Resource: 'local:feature:retry-catch:outer-flow',
            Retry: [
              {
                ErrorEquals: ['TransientError'],
                IntervalSeconds: 1,
                MaxAttempts: 1,
                BackoffRate: 2,
              },
            ],
            Catch: [
              {
                ErrorEquals: ['States.ALL'],
                ResultPath: '$.taskFailure',
                Next: 'ContinueAfterCatch',
              },
            ],
            End: true,
          },
          ContinueAfterCatch: {
            Type: 'Pass',
            Result: {
              continued: true,
              resumedAt: 'ContinueAfterCatch',
            },
            ResultPath: '$.workflow',
            Next: 'Finalize',
          },
          Finalize: {
            Type: 'Pass',
            Result: { done: true },
            ResultPath: '$.workflow.final',
            End: true,
          },
        },
      },
      input: {
        requestId: 'req-retry-catch-5',
      },
      setupLocalResources: () => ({
        'local:feature:retry-catch:outer-flow': () => {
          attempts += 1;
          throw new ExecutionError('TransientError', `outer-flow-attempt-${attempts}`);
        },
      }),
      setupLocalRuntime: noDelayRuntimeSetup,
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual({
          requestId: 'req-retry-catch-5',
          meta: {
            seeded: true,
          },
          taskFailure: {
            Error: 'TransientError',
            Cause: 'outer-flow-attempt-2',
          },
          workflow: {
            continued: true,
            resumedAt: 'ContinueAfterCatch',
            final: {
              done: true,
            },
          },
        });
        expect(attempts).toBe(2);
      },
      source: {
        file: sourceFile,
        notes:
          'Shows the canonical outer-flow pattern: the task absorbs its own retried failure via Catch and the surrounding workflow still reaches later states.',
      },
    });
  })(),
  (() => {
    const recordedSleeps: number[] = [];
    let attempts = 0;

    return customDefinitionCase({
      id: '006-first-retrier-then-second-retrier-before-success',
      title: 'different retriers can handle different phases before Catch is bypassed by success',
      group,
      tags: ['retry', 'catch', 'composition', 'ordering', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Uses a local stateful stub to force a timeout phase followed by a second exact-match retry phase.',
      definition: {
        StartAt: 'InvokeTask',
        States: {
          InvokeTask: {
            Type: 'Task',
            Resource: 'local:feature:retry-catch:phased-retries',
            Retry: [
              {
                ErrorEquals: ['States.Timeout'],
                IntervalSeconds: 1,
                MaxAttempts: 1,
                BackoffRate: 2,
              },
              {
                ErrorEquals: ['DownstreamError'],
                IntervalSeconds: 1,
                MaxAttempts: 1,
                BackoffRate: 2,
              },
            ],
            Catch: [
              {
                ErrorEquals: ['States.ALL'],
                ResultPath: '$.caught',
                Next: 'Recovered',
              },
            ],
            End: true,
          },
          Recovered: {
            Type: 'Pass',
            Result: { reached: 'catch' },
            ResultPath: '$.recovery',
            End: true,
          },
        },
      },
      input: {},
      setupLocalResources: () => ({
        'local:feature:retry-catch:phased-retries': () => {
          attempts += 1;

          if (attempts === 1) {
            throw new ExecutionError('States.Timeout', 'phase-one-timeout');
          }

          if (attempts === 2) {
            throw new ExecutionError('DownstreamError', 'phase-two-downstream');
          }

          return {
            ok: true,
            attempts,
            phases: ['timeout', 'downstream'],
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
          phases: ['timeout', 'downstream'],
        });
        expect(recordedSleeps).toStrictEqual([1000, 1000]);
      },
      source: {
        file: sourceFile,
        notes:
          'Captures phased retrier matching in the presence of Catch, proving the task can succeed after different retry rules fire on different attempts without falling into recovery.',
      },
    });
  })(),
];
