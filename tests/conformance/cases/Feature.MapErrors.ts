import { expect } from 'vitest';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.MapErrors';
const sourceFile = 'src/states/index.ts';
const localMapFailureResource = 'arn:local:feature:map-errors:failure';
const localMapRetryResource = 'arn:local:feature:map-errors:retry';
const localInnerCatchResource = 'arn:local:feature:map-errors:inner-catch';
const localAggregateRecoveryResource = 'arn:local:feature:map-errors:aggregate-recovery';

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

function expectFailure(error: string, causeIncludes: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));
    expect(result.cause).toContain(causeIncludes);
  };
}

function expectRecoveredWithoutProcessed(
  shape: Record<string, unknown>
): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toMatchObject(shape);
    expect(result.output).not.toHaveProperty('processed');
  };
}

export const featureMapErrorsCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-processor-failure-fails-whole-map',
    title: 'processor failure causes the whole Map state to fail',
    group,
    tags: ['map', 'error_handling', 'local_only'],
    awsExecutable: false,
    skipReason: 'Uses a local synthetic processor to raise a deterministic item failure.',
    definition: {
      StartAt: 'ProcessItems',
      States: {
        ProcessItems: {
          Type: 'Map',
          ItemsPath: '$.items',
          ResultPath: '$.processed',
          Iterator: {
            StartAt: 'DoWork',
            States: {
              DoWork: {
                Type: 'Task',
                Resource: localMapFailureResource,
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      batchId: 'batch-map-errors-1',
      items: [{ id: 'ok-1' }, { id: 'broken', fail: true }, { id: 'ok-2' }],
    },
    setupLocalResources: () => ({
      [localMapFailureResource]: payload => {
        const item = payload as { id: string; fail?: boolean };
        if (item.fail) {
          throw new ExecutionError('SyntheticMapItemError', `processor failed for ${item.id}`);
        }

        return { id: item.id, status: 'ok' };
      },
    }),
    expected: expectFailure('SyntheticMapItemError', 'processor failed for broken'),
    source: {
      file: sourceFile,
      notes:
        'Covers the classic container semantic that an uncaught iterator task failure aborts the whole Map and produces no aggregate output.',
    },
  }),

  customDefinitionCase({
    id: '002-map-level-catch-recovers-processor-failure',
    title: 'map-level Catch recovers a processor failure without leaking partial aggregate output',
    group,
    tags: ['map', 'error_handling', 'catch', 'result_path', 'local_only'],
    awsExecutable: false,
    skipReason: 'Uses a local synthetic processor to force a deterministic map-level Catch path.',
    definition: {
      StartAt: 'ProcessItems',
      States: {
        ProcessItems: {
          Type: 'Map',
          ItemsPath: '$.items',
          ResultPath: '$.processed',
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.mapError',
              Next: 'Recovered',
            },
          ],
          Iterator: {
            StartAt: 'DoWork',
            States: {
              DoWork: {
                Type: 'Task',
                Resource: localMapFailureResource,
                End: true,
              },
            },
          },
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: {
            recovered: true,
            at: 'map-level-catch',
          },
          ResultPath: '$.status',
          End: true,
        },
      },
    },
    input: {
      batchId: 'batch-map-errors-2',
      items: [{ id: 'ok-1' }, { id: 'broken', fail: true }, { id: 'ok-2' }],
    },
    setupLocalResources: () => ({
      [localMapFailureResource]: payload => {
        const item = payload as { id: string; fail?: boolean };
        if (item.fail) {
          throw new ExecutionError('SyntheticMapItemError', `processor failed for ${item.id}`);
        }

        return { id: item.id, status: 'ok' };
      },
    }),
    expected: expectRecoveredWithoutProcessed({
      batchId: 'batch-map-errors-2',
      items: [{ id: 'ok-1' }, { id: 'broken', fail: true }, { id: 'ok-2' }],
      mapError: {
        Error: 'SyntheticMapItemError',
        Cause: 'processor failed for broken',
      },
      status: {
        recovered: true,
        at: 'map-level-catch',
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Asserts that a container-level catcher can recover from iterator failure and that the failed Map does not inject a partial processed array into ResultPath.',
    },
  }),

  customDefinitionCase({
    id: '003-map-level-retry-reruns-work-after-transient-failure',
    title: 'map-level Retry reruns map work after a transient processor failure',
    group,
    tags: ['map', 'error_handling', 'retry', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses a stateful local processor closure to make whole-map retry behavior deterministic.',
    definition: {
      StartAt: 'ProcessItems',
      States: {
        ProcessItems: {
          Type: 'Map',
          ItemsPath: '$.items',
          Iterator: {
            StartAt: 'DoWork',
            States: {
              DoWork: {
                Type: 'Task',
                Resource: localMapRetryResource,
                End: true,
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
          End: true,
        },
      },
    },
    input: {
      items: [{ id: 'stable' }, { id: 'flaky', failOnce: true }],
    },
    setupLocalRuntime: noDelayRuntimeSetup,
    setupLocalResources: () => {
      const attemptsById = new Map<string, number>();

      return {
        [localMapRetryResource]: payload => {
          const item = payload as { id: string; failOnce?: boolean };
          const nextAttempt = (attemptsById.get(item.id) ?? 0) + 1;
          attemptsById.set(item.id, nextAttempt);

          if (item.failOnce && nextAttempt === 1) {
            throw new ExecutionError(
              'TransientMapItemError',
              `transient failure for ${item.id} on attempt ${nextAttempt}`
            );
          }

          return {
            id: item.id,
            attemptsSeen: nextAttempt,
          };
        },
      };
    },
    expected: expectOutput([
      { id: 'stable', attemptsSeen: 2 },
      { id: 'flaky', attemptsSeen: 2 },
    ]),
    source: {
      file: sourceFile,
      notes:
        'The stable item returning attemptsSeen 2 proves the retried Map reruns container work, not only the failing item.',
    },
  }),

  customDefinitionCase({
    id: '004-inner-task-catch-prevents-whole-map-failure',
    title: 'inner task Catch prevents whole-map failure and preserves aggregate output',
    group,
    tags: ['map', 'error_handling', 'catch', 'iterator', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses a local synthetic processor so each item can deterministically succeed or recover inside the iterator.',
    definition: {
      StartAt: 'ProcessItems',
      States: {
        ProcessItems: {
          Type: 'Map',
          ItemsPath: '$.items',
          Iterator: {
            StartAt: 'InvokeProcessor',
            States: {
              InvokeProcessor: {
                Type: 'Task',
                Resource: localInnerCatchResource,
                Catch: [
                  {
                    ErrorEquals: ['ItemRecoverableError'],
                    ResultPath: '$.taskError',
                    Next: 'RecoveredItem',
                  },
                ],
                End: true,
              },
              RecoveredItem: {
                Type: 'Pass',
                Parameters: {
                  'id.$': '$.id',
                  status: 'recovered',
                  'error.$': '$.taskError.Error',
                },
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      items: [{ id: 'ok-1' }, { id: 'recover-me', fail: true }, { id: 'ok-2' }],
    },
    setupLocalResources: () => ({
      [localInnerCatchResource]: payload => {
        const item = payload as { id: string; fail?: boolean };
        if (item.fail) {
          throw new ExecutionError('ItemRecoverableError', `recoverable failure for ${item.id}`);
        }

        return { id: item.id, status: 'ok' };
      },
    }),
    expected: expectOutput([
      { id: 'ok-1', status: 'ok' },
      { id: 'recover-me', status: 'recovered', error: 'ItemRecoverableError' },
      { id: 'ok-2', status: 'ok' },
    ]),
    source: {
      file: sourceFile,
      notes:
        'Shows the contrasting item-level semantic: the iterator can absorb a task failure and still let the enclosing Map produce a full aggregate array.',
    },
  }),

  customDefinitionCase({
    id: '005-recovery-can-explicitly-rebuild-aggregate-output',
    title: 'recovery can explicitly rebuild aggregate output after a map failure',
    group,
    tags: ['map', 'error_handling', 'catch', 'result_path', 'local_only'],
    awsExecutable: false,
    skipReason:
      'Uses a local synthetic processor to force failure, then characterizes recovery-built aggregate output deterministically.',
    definition: {
      StartAt: 'ProcessItems',
      States: {
        ProcessItems: {
          Type: 'Map',
          ItemsPath: '$.items',
          ResultPath: '$.processed',
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              ResultPath: '$.mapError',
              Next: 'BuildFallbackAggregate',
            },
          ],
          Iterator: {
            StartAt: 'DoWork',
            States: {
              DoWork: {
                Type: 'Task',
                Resource: localAggregateRecoveryResource,
                End: true,
              },
            },
          },
          End: true,
        },
        BuildFallbackAggregate: {
          Type: 'Pass',
          Result: [{ id: 'fallback', status: 'map-recovered' }],
          ResultPath: '$.processed',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-map-errors-5',
      items: [{ id: 'broken', fail: true }],
    },
    setupLocalResources: () => ({
      [localAggregateRecoveryResource]: payload => {
        const item = payload as { id: string; fail?: boolean };
        if (item.fail) {
          throw new ExecutionError('SyntheticAggregateMapError', `processor failed for ${item.id}`);
        }

        return { id: item.id, status: 'ok' };
      },
    }),
    expected: expectOutput({
      requestId: 'req-map-errors-5',
      items: [{ id: 'broken', fail: true }],
      mapError: {
        Error: 'SyntheticAggregateMapError',
        Cause: 'processor failed for broken',
      },
      processed: [{ id: 'fallback', status: 'map-recovered' }],
    }),
    source: {
      file: sourceFile,
      notes:
        'Complements the no-partial-output recovery case by showing that downstream recovery logic may intentionally repopulate the aggregate result path.',
    },
  }),
];
