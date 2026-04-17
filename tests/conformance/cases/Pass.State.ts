import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Pass.State';

const expectOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toStrictEqual(output);
};

export const passStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-static-result-replaces-input',
    title: 'uses a static Result as the state output',
    group,
    tags: ['happy_path', 'result'],
    definition: {
      StartAt: 'ReplaceWithStaticResult',
      States: {
        ReplaceWithStaticResult: {
          Type: 'Pass',
          Result: {
            status: 'done',
            code: 200,
          },
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-123',
      original: true,
    },
    expected: expectOutput({
      status: 'done',
      code: 200,
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Extends basic Pass-state coverage with an explicit static Result replacement case.',
    },
  }),
  customDefinitionCase({
    id: '002-parameters-reshapes-input',
    title: 'uses Parameters to reshape selected input into a new object',
    group,
    tags: ['happy_path', 'parameters'],
    definition: {
      StartAt: 'ReshapeInput',
      States: {
        ReshapeInput: {
          Type: 'Pass',
          Parameters: {
            userId: 7,
            'name.$': '$.profile.name',
            'role.$': '$.profile.role',
            'isActive.$': '$.flags.active',
            metadata: {
              source: 'pass-state',
            },
          },
          End: true,
        },
      },
    },
    input: {
      profile: {
        name: 'Ada',
        role: 'admin',
      },
      flags: {
        active: true,
      },
      ignored: 'value',
    },
    expected: expectOutput({
      userId: 7,
      name: 'Ada',
      role: 'admin',
      isActive: true,
      metadata: {
        source: 'pass-state',
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Keeps the case intrinsic-light and focused on Pass Parameters object construction.',
    },
  }),
  customDefinitionCase({
    id: '003-resultpath-null-preserves-input',
    title: 'ignores the state result when ResultPath is null',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'IgnoreComputedResult',
      States: {
        IgnoreComputedResult: {
          Type: 'Pass',
          Result: {
            shouldNotAppear: true,
          },
          ResultPath: null,
          End: true,
        },
      },
    },
    input: {
      orderId: 'A-100',
      totals: {
        subtotal: 12,
        tax: 3,
      },
    },
    expected: expectOutput({
      orderId: 'A-100',
      totals: {
        subtotal: 12,
        tax: 3,
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Captures the Step Functions semantic where ResultPath null preserves the original input.',
    },
  }),
  customDefinitionCase({
    id: '004-outputpath-projects-nested-output',
    title: 'projects a nested branch of the Pass output with OutputPath',
    group,
    tags: ['happy_path', 'output_path'],
    definition: {
      StartAt: 'BuildEnvelope',
      States: {
        BuildEnvelope: {
          Type: 'Pass',
          Result: {
            envelope: {
              customer: {
                id: 'cust-9',
                tier: 'gold',
              },
              request: {
                region: 'us-east-1',
              },
            },
          },
          OutputPath: '$.envelope.customer',
          End: true,
        },
      },
    },
    input: {
      ignored: true,
    },
    expected: expectOutput({
      id: 'cust-9',
      tier: 'gold',
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Validates OutputPath projection independently from intrinsic evaluation.',
    },
  }),
  customDefinitionCase({
    id: '005-next-transition-into-terminal-state',
    title: 'transitions from Pass into a terminal Succeed state',
    group,
    tags: ['happy_path', 'transition'],
    definition: {
      StartAt: 'Annotate',
      States: {
        Annotate: {
          Type: 'Pass',
          Result: {
            state: 'prepared',
          },
          ResultPath: '$.status',
          Next: 'Done',
        },
        Done: {
          Type: 'Succeed',
        },
      },
    },
    input: {
      jobId: 'job-42',
      payload: {
        step: 1,
      },
    },
    expected: expectOutput({
      jobId: 'job-42',
      payload: {
        step: 1,
      },
      status: {
        state: 'prepared',
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Confirms that Pass-state output flows through a Next transition into a terminal state.',
    },
  }),
];
