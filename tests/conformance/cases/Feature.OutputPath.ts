import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.OutputPath';
const sourceFile = 'src/states/index.ts';

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

export const featureOutputPathCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-projects-nested-object',
    title: 'OutputPath projects a nested object from the post-processed state output',
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
                id: 'cust-22',
                plan: 'pro',
              },
              request: {
                region: 'eu-central-1',
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
      id: 'cust-22',
      plan: 'pro',
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps OutputPath coverage focused on final projection rather than upstream result shaping.',
    },
  }),
  customDefinitionCase({
    id: '002-root-preserves-full-output',
    title: 'OutputPath dollar returns the entire post-processed output unchanged',
    group,
    tags: ['happy_path', 'output_path'],
    definition: {
      StartAt: 'KeepAllOutput',
      States: {
        KeepAllOutput: {
          Type: 'Pass',
          Result: {
            status: 'ok',
            counts: {
              processed: 2,
            },
          },
          OutputPath: '$',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-21',
    },
    expected: expectOutput({
      status: 'ok',
      counts: {
        processed: 2,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Separates the explicit OutputPath "$" branch from default behavior with no OutputPath field at all.',
    },
  }),
  customDefinitionCase({
    id: '003-projects-after-resultpath',
    title: 'OutputPath projects from the structure produced after ResultPath insertion',
    group,
    tags: ['happy_path', 'result_path', 'output_path'],
    definition: {
      StartAt: 'InsertAndProject',
      States: {
        InsertAndProject: {
          Type: 'Pass',
          Result: {
            status: 'ready',
            code: 201,
          },
          ResultPath: '$.service.response',
          OutputPath: '$.service.response.status',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-22',
      service: {
        name: 'billing',
      },
    },
    expected: expectOutput('ready'),
    source: {
      file: sourceFile,
      notes:
        'Makes the processing order visible by proving OutputPath reads from the ResultPath-enriched output.',
    },
  }),
  customDefinitionCase({
    id: '004-projects-array-element',
    title: 'OutputPath can project a specific array element from the final output',
    group,
    tags: ['happy_path', 'output_path'],
    definition: {
      StartAt: 'BuildItems',
      States: {
        BuildItems: {
          Type: 'Pass',
          Result: {
            items: [
              { id: 'first', quantity: 1 },
              { id: 'second', quantity: 2 },
            ],
          },
          OutputPath: '$.items[1]',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      id: 'second',
      quantity: 2,
    }),
    source: {
      file: sourceFile,
      notes:
        'Ensures OutputPath projection coverage includes basic array indexing rather than object-only selection.',
    },
  }),
  customDefinitionCase({
    id: '005-invalid-path-fails',
    title: 'OutputPath fails when given an invalid JSONPath string',
    group,
    tags: ['negative', 'output_path', 'invalid_path'],
    definition: {
      StartAt: 'InvalidOutputPath',
      States: {
        InvalidOutputPath: {
          Type: 'Pass',
          Result: {
            visible: true,
          },
          OutputPath: 'not-a-path',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-23',
    },
    expected: expectFailure('States.Runtime', 'Invalid intrinsic invocation'),
    awsExecutable: false,
    skipReason:
      'Current runtime surfaces invalid OutputPath syntax as a local JSONPath parse failure; keep this as local characterization until AWS parity is pinned down.',
    source: {
      file: sourceFile,
      notes:
        'Documents present OutputPath failure behavior without overstating AWS-compatible error semantics.',
    },
  }),
];
