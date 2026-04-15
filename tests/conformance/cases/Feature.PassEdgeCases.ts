import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.PassEdgeCases';
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

export const featurePassEdgeCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-object-result-inserted-into-nested-resultpath',
    title:
      'inserts an object Result into a nested ResultPath while preserving surrounding input data',
    group,
    tags: ['happy_path', 'result', 'result_path'],
    definition: {
      StartAt: 'AnnotateReview',
      States: {
        AnnotateReview: {
          Type: 'Pass',
          Result: {
            approved: true,
            reviewer: 'sam',
          },
          ResultPath: '$.workflow.audit.final',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-31',
      workflow: {
        step: 'review',
        audit: {
          startedBy: 'alex',
        },
      },
      untouched: ['keep'],
    },
    expected: expectOutput({
      requestId: 'req-31',
      workflow: {
        step: 'review',
        audit: {
          startedBy: 'alex',
          final: {
            approved: true,
            reviewer: 'sam',
          },
        },
      },
      untouched: ['keep'],
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps Pass coverage focused on nested object insertion rather than whole-input replacement.',
    },
  }),
  customDefinitionCase({
    id: '002-scalar-result-inserted-into-nested-resultpath',
    title: 'inserts a scalar Result into a nested ResultPath under an existing object branch',
    group,
    tags: ['happy_path', 'result', 'result_path', 'scalar'],
    definition: {
      StartAt: 'SetCurrentStatus',
      States: {
        SetCurrentStatus: {
          Type: 'Pass',
          Result: 'complete',
          ResultPath: '$.workflow.audit.status.current',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-32',
      workflow: {
        audit: {
          status: {
            previous: 'pending',
          },
        },
      },
      untouched: true,
    },
    expected: expectOutput({
      requestId: 'req-32',
      workflow: {
        audit: {
          status: {
            previous: 'pending',
            current: 'complete',
          },
        },
      },
      untouched: true,
    }),
    source: {
      file: sourceFile,
      notes:
        'Makes scalar insertion semantics explicit instead of only covering object-shaped results.',
    },
  }),
  customDefinitionCase({
    id: '003-outputpath-null-local-characterization',
    title: 'documents current local behavior when a Pass state uses OutputPath null',
    group,
    tags: ['negative', 'output_path', 'local_only'],
    definition: {
      StartAt: 'DropOutputWithNullPath',
      States: {
        DropOutputWithNullPath: {
          Type: 'Pass',
          Result: {
            visible: true,
          },
          OutputPath: null,
          End: true,
        },
      },
    } as unknown as ConformanceCase['definition'],
    input: {
      requestId: 'req-33',
    },
    expected: expectFailure('InvalidJSONPath', 'JSON Path should be a string! Value: null'),
    awsExecutable: false,
    skipReason:
      'Local characterization: current runtime/types do not yet model AWS OutputPath null semantics.',
    source: {
      file: sourceFile,
      notes:
        'Pins the present string-only OutputPath implementation until explicit AWS-null parity is added.',
    },
  }),
  customDefinitionCase({
    id: '004-non-reference-resultpath-shape-local-characterization',
    title:
      'documents current local behavior for a wildcard ResultPath shape that is not an AWS reference path',
    group,
    tags: ['negative', 'result_path', 'local_only'],
    definition: {
      StartAt: 'WriteThroughWildcard',
      States: {
        WriteThroughWildcard: {
          Type: 'Pass',
          Result: {
            replaced: true,
          },
          ResultPath: '$.items[*]',
          End: true,
        },
      },
    },
    input: {
      items: [
        { id: 'first', keep: true },
        { id: 'second', keep: true },
      ],
      requestId: 'req-34',
    },
    expected: expectOutput({
      items: [{ replaced: true }, { id: 'second', keep: true }],
      requestId: 'req-34',
    }),
    awsExecutable: false,
    skipReason:
      'Local characterization: wildcard ResultPath is not an AWS-portable reference path.',
    source: {
      file: sourceFile,
      notes: 'Captures current jsonpath.value write behavior for an out-of-spec ResultPath shape.',
    },
  }),
  customDefinitionCase({
    id: '005-missing-parent-container-local-characterization',
    title: 'documents current local behavior when ResultPath targets a missing parent container',
    group,
    tags: ['result_path', 'local_only', 'boundary'],
    definition: {
      StartAt: 'MaterializeMissingParents',
      States: {
        MaterializeMissingParents: {
          Type: 'Pass',
          Result: {
            score: 7,
            verdict: 'pass',
          },
          ResultPath: '$.summary.metrics',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-35',
      detail: {
        existing: true,
      },
    },
    expected: expectOutput({
      requestId: 'req-35',
      detail: {
        existing: true,
      },
      summary: {
        metrics: {
          score: 7,
          verdict: 'pass',
        },
      },
    }),
    awsExecutable: false,
    skipReason: 'Local characterization: current ResultPath writes create missing parent objects.',
    source: {
      file: sourceFile,
      notes:
        'Matches the current updatePath-based materialization behavior when intermediate objects do not exist.',
    },
  }),
  customDefinitionCase({
    id: '006-parameters-plus-result-result-wins-local-characterization',
    title:
      'documents current local precedence when a Pass state defines both Parameters and Result',
    group,
    tags: ['parameters', 'result', 'local_only'],
    definition: {
      StartAt: 'PreferStaticResult',
      States: {
        PreferStaticResult: {
          Type: 'Pass',
          Parameters: {
            fromParameters: true,
            'picked.$': '$.inputValue',
          },
          Result: {
            fromResult: true,
          },
          ResultPath: '$.computed',
          End: true,
        },
      },
    },
    input: {
      inputValue: 9,
      original: true,
    },
    expected: expectOutput({
      inputValue: 9,
      original: true,
      computed: {
        fromResult: true,
      },
    }),
    awsExecutable: false,
    skipReason:
      'Local characterization: Pass precedence for Parameters plus Result is not yet AWS-observed.',
    source: {
      file: sourceFile,
      notes:
        'Current executor treats Result as the virtual task output and bypasses Parameters when both are present.',
    },
  }),
];
