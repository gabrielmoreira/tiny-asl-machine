import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase } from '../support/types';

const group = 'Parallel.State';

const expectOutput =
  (output: unknown): ConformanceCase['expected'] =>
  result => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };

const expectFailure =
  (error: string, options: { causeIncludes?: string } = {}): ConformanceCase['expected'] =>
  result => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));

    if (options.causeIncludes) {
      expect(result.cause).toContain(options.causeIncludes);
    }
  };

class ParallelBranchBoom extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParallelBranchBoom';
  }
}

export const parallelStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-branch-order',
    title: 'aggregates branch outputs in declaration order',
    group,
    tags: ['happy_path', 'ordering', 'local_only'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'SlowBranch',
              States: {
                SlowBranch: {
                  Type: 'Task',
                  Resource: 'local:slow-branch',
                  End: true,
                },
              },
            },
            {
              StartAt: 'FastBranch',
              States: {
                FastBranch: {
                  Type: 'Task',
                  Resource: 'local:fast-branch',
                  End: true,
                },
              },
            },
          ],
          End: true,
        },
      },
    },
    input: { value: 4 },
    expected: expectOutput([
      {
        branch: 'slow',
        seen: { value: 4 },
        completionOrder: 2,
      },
      {
        branch: 'fast',
        seen: { value: 4 },
        completionOrder: 1,
      },
    ]),
    awsExecutable: false,
    setupLocalResources: () => ({
      'local:slow-branch': async payload => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          branch: 'slow',
          seen: payload,
          completionOrder: 2,
        };
      },
      'local:fast-branch': async payload => ({
        branch: 'fast',
        seen: payload,
        completionOrder: 1,
      }),
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Extends the basic Parallel execution coverage to assert output ordering explicitly.',
    },
  }),
  customDefinitionCase({
    id: '002-shared-effective-input',
    title: 'all branches receive the same effective input',
    group,
    tags: ['happy_path', 'input_path', 'local_only'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          InputPath: '$.payload',
          Branches: [
            {
              StartAt: 'InspectAlpha',
              States: {
                InspectAlpha: {
                  Type: 'Task',
                  Resource: 'local:inspect-alpha',
                  Parameters: {
                    branch: 'alpha',
                    'snapshot.$': '$',
                  },
                  End: true,
                },
              },
            },
            {
              StartAt: 'InspectBeta',
              States: {
                InspectBeta: {
                  Type: 'Task',
                  Resource: 'local:inspect-beta',
                  Parameters: {
                    branch: 'beta',
                    'snapshot.$': '$',
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
      ignored: { requestId: 'req-9' },
      payload: {
        user: { id: 'user-1' },
        flags: ['red', 'blue'],
        count: 3,
      },
    },
    expected: expectOutput([
      {
        branch: 'alpha',
        snapshot: {
          user: { id: 'user-1' },
          flags: ['red', 'blue'],
          count: 3,
        },
      },
      {
        branch: 'beta',
        snapshot: {
          user: { id: 'user-1' },
          flags: ['red', 'blue'],
          count: 3,
        },
      },
    ]),
    awsExecutable: false,
    setupLocalResources: () => ({
      'local:inspect-alpha': async payload => payload,
      'local:inspect-beta': async payload => payload,
    }),
  }),
  customDefinitionCase({
    id: '003-resultpath-envelope',
    title: 'ResultPath inserts the branch output array into an envelope',
    group,
    tags: ['happy_path', 'result_path', 'local_only'],
    definition: {
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          ResultPath: '$.envelope.parallel',
          Branches: [
            {
              StartAt: 'Double',
              States: {
                Double: {
                  Type: 'Task',
                  Resource: 'local:double',
                  Parameters: {
                    operation: 'double',
                    'value.$': '$.amount',
                  },
                  End: true,
                },
              },
            },
            {
              StartAt: 'Triple',
              States: {
                Triple: {
                  Type: 'Task',
                  Resource: 'local:triple',
                  Parameters: {
                    operation: 'triple',
                    'value.$': '$.amount',
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
      requestId: 'req-7',
      amount: 5,
      envelope: {
        existing: true,
      },
    },
    expected: expectOutput({
      requestId: 'req-7',
      amount: 5,
      envelope: {
        existing: true,
        parallel: [
          { operation: 'double', result: 10 },
          { operation: 'triple', result: 15 },
        ],
      },
    }),
    awsExecutable: false,
    setupLocalResources: () => ({
      'local:double': async payload => ({
        operation: (payload as { operation: string }).operation,
        result: (payload as { value: number }).value * 2,
      }),
      'local:triple': async payload => ({
        operation: (payload as { operation: string }).operation,
        result: (payload as { value: number }).value * 3,
      }),
    }),
  }),
  customDefinitionCase({
    id: '004-branch-failure',
    title: 'branch failure propagates',
    group,
    tags: ['negative', 'error_propagation', 'local_only'],
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
                  Type: 'Task',
                  Resource: 'local:healthy-branch',
                  End: true,
                },
              },
            },
            {
              StartAt: 'FailingBranch',
              States: {
                FailingBranch: {
                  Type: 'Task',
                  Resource: 'local:failing-branch',
                  End: true,
                },
              },
            },
          ],
          End: true,
        },
      },
    },
    input: { value: 9 },
    expected: expectFailure('ParallelBranchBoom', {
      causeIncludes: 'second branch exploded',
    }),
    awsExecutable: false,
    setupLocalResources: () => ({
      'local:healthy-branch': async payload => ({
        ok: true,
        seen: payload,
      }),
      'local:failing-branch': async () => {
        throw new ParallelBranchBoom('second branch exploded');
      },
    }),
  }),
];
