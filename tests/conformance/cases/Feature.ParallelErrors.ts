import { expect } from 'vite-plus/test';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.ParallelErrors';
const sourceFile = 'src/states/index.ts';
const localStableRetryResource = 'local:feature:parallel-errors:stable-retry';
const localFlakyRetryResource = 'local:feature:parallel-errors:flaky-retry';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
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

const noDelayRuntimeSetup = () => ({
  sleep: async () => undefined,
});

export const featureParallelErrorsCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-branch-failure-fails-parallel',
    title: 'branch failure causes the whole parallel state to fail',
    description:
      'AWS-first case using a Fail state in one branch so the container failure semantics are observable without local resource mocks.',
    group,
    tags: ['parallel', 'error_handling', 'aws_first'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'HealthyBranch',
              States: {
                HealthyBranch: {
                  Type: 'Pass',
                  Result: {
                    branch: 'healthy',
                    status: 'ok',
                  },
                  End: true,
                },
              },
            },
            {
              StartAt: 'FailingBranch',
              States: {
                FailingBranch: {
                  Type: 'Fail',
                  Error: 'BranchFailure',
                  Cause: 'parallel branch exploded',
                },
              },
            },
          ],
          End: true,
        },
      },
    },
    input: {
      requestId: 'parallel-error-1',
    },
    expected: expectFailure('BranchFailure', 'parallel branch exploded'),
    source: {
      file: sourceFile,
      notes:
        'Pins the core container rule that any uncaught branch failure terminates the whole Parallel state.',
    },
  }),
  customDefinitionCase({
    id: '002-parent-catch-recovers-branch-failure',
    title: 'parent parallel Catch recovers a branch failure',
    description:
      'AWS-first case proving that a Catch on the Parallel container receives the branch error and can continue the workflow.',
    group,
    tags: ['parallel', 'catch', 'result_path', 'aws_first'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'HealthyBranch',
              States: {
                HealthyBranch: {
                  Type: 'Pass',
                  Result: {
                    branch: 'healthy',
                    status: 'ok',
                  },
                  End: true,
                },
              },
            },
            {
              StartAt: 'FailingBranch',
              States: {
                FailingBranch: {
                  Type: 'Fail',
                  Error: 'BranchFailure',
                  Cause: 'parallel branch exploded',
                },
              },
            },
          ],
          Catch: [
            {
              ErrorEquals: ['BranchFailure'],
              ResultPath: '$.parallelError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: {
            recoveredBy: 'parallel-catch',
          },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: {
      requestId: 'parallel-error-2',
      original: true,
    },
    expected: expectOutput({
      requestId: 'parallel-error-2',
      original: true,
      parallelError: {
        Error: 'BranchFailure',
        Cause: 'parallel branch exploded',
      },
      recovery: {
        recoveredBy: 'parallel-catch',
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Asserts that Parallel-level Catch receives the failing branch error envelope and that ResultPath shaping happens on the container input.',
    },
  }),
  customDefinitionCase({
    id: '003-parent-retry-retries-whole-container',
    title: 'parent parallel Retry retries the container state',
    description:
      'Local characterization case using invocation counters to prove a successful sibling branch is re-run when the Parallel state retries after a branch failure.',
    group,
    tags: ['parallel', 'retry', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses local resource invocation counters to prove whole-container re-execution, which is difficult to assert deterministically without dedicated AWS-side fixtures or history inspection.',
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          Retry: [
            {
              ErrorEquals: ['States.ALL'],
              IntervalSeconds: 1,
              MaxAttempts: 1,
              BackoffRate: 2,
            },
          ],
          Branches: [
            {
              StartAt: 'StableBranch',
              States: {
                StableBranch: {
                  Type: 'Task',
                  Resource: localStableRetryResource,
                  End: true,
                },
              },
            },
            {
              StartAt: 'FlakyBranch',
              States: {
                FlakyBranch: {
                  Type: 'Task',
                  Resource: localFlakyRetryResource,
                  End: true,
                },
              },
            },
          ],
          End: true,
        },
      },
    },
    input: {
      requestId: 'parallel-error-3',
    },
    setupLocalRuntime: noDelayRuntimeSetup,
    setupLocalResources: () => {
      let stableInvocations = 0;
      let flakyInvocations = 0;

      return {
        [localStableRetryResource]: () => {
          stableInvocations += 1;
          return {
            branch: 'stable',
            invocation: stableInvocations,
          };
        },
        [localFlakyRetryResource]: () => {
          flakyInvocations += 1;

          if (flakyInvocations === 1) {
            throw new ExecutionError(
              'BranchRetryBoom',
              'flaky branch fails on the first container attempt'
            );
          }

          return {
            branch: 'flaky',
            invocation: flakyInvocations,
          };
        },
      };
    },
    expected: expectOutput([
      {
        branch: 'stable',
        invocation: 2,
      },
      {
        branch: 'flaky',
        invocation: 2,
      },
    ]),
    source: {
      file: sourceFile,
      notes:
        'The stable branch returning invocation 2 proves the retry restarted the Parallel container instead of resuming only the failed branch.',
    },
  }),
  customDefinitionCase({
    id: '004-resultpath-outputpath-after-aggregate-output',
    title: 'ResultPath and OutputPath can select the aggregate branch output',
    description:
      'AWS-first case keeping branch logic in Pass states while asserting post-join shaping of the aggregated array.',
    group,
    tags: ['parallel', 'ordering', 'result_path', 'output_path', 'aws_first'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          ResultPath: '$.envelope.parallelResults',
          OutputPath: '$.envelope.parallelResults',
          Branches: [
            {
              StartAt: 'NumbersBranch',
              States: {
                NumbersBranch: {
                  Type: 'Pass',
                  Result: {
                    branch: 'numbers',
                    values: [2, 4, 6],
                  },
                  End: true,
                },
              },
            },
            {
              StartAt: 'MetadataBranch',
              States: {
                MetadataBranch: {
                  Type: 'Pass',
                  Result: {
                    branch: 'metadata',
                    summary: {
                      ok: true,
                      source: 'parallel',
                    },
                  },
                  End: true,
                },
              },
            },
          ],
          End: true,
        },
      },
    },
    input: {
      requestId: 'parallel-error-4',
      envelope: {
        existing: true,
      },
    },
    expected: expectOutput([
      {
        branch: 'numbers',
        values: [2, 4, 6],
      },
      {
        branch: 'metadata',
        summary: {
          ok: true,
          source: 'parallel',
        },
      },
    ]),
    source: {
      file: sourceFile,
      notes:
        'Covers post-aggregation shaping on Parallel by merging into an envelope first and then projecting only the aggregate array.',
    },
  }),
];
