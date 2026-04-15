import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.ResultPath';
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

export const featureResultPathCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-null-preserves-input',
    title: 'ResultPath null preserves the original input and discards the state result',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'DiscardResult',
      States: {
        DiscardResult: {
          Type: 'Pass',
          Result: {
            computed: true,
            score: 99,
          },
          ResultPath: null,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-11',
      original: {
        keep: true,
      },
    },
    expected: expectOutput({
      requestId: 'req-11',
      original: {
        keep: true,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Targets the explicit applyResultPath(null) branch that returns the incoming input unchanged.',
    },
  }),
  customDefinitionCase({
    id: '002-root-replaces-input',
    title: 'ResultPath dollar replaces the entire input with the state result',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'ReplaceInput',
      States: {
        ReplaceInput: {
          Type: 'Pass',
          Result: {
            status: 'done',
            count: 3,
          },
          ResultPath: '$',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-12',
      ignored: true,
    },
    expected: expectOutput({
      status: 'done',
      count: 3,
    }),
    source: {
      file: sourceFile,
      notes: 'Separates full-input replacement semantics from nested insertion semantics.',
    },
  }),
  customDefinitionCase({
    id: '003-nested-insertion-creates-missing-parents',
    title: 'ResultPath inserts the result at a nested path and creates missing parent objects',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'InsertNested',
      States: {
        InsertNested: {
          Type: 'Pass',
          Result: {
            approved: true,
            reviewer: 'sam',
          },
          ResultPath: '$.audit.review.final',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-13',
      audit: {
        started: true,
      },
    },
    expected: expectOutput({
      requestId: 'req-13',
      audit: {
        started: true,
        review: {
          final: {
            approved: true,
            reviewer: 'sam',
          },
        },
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Matches the current updatePath behavior that materializes missing parent objects during nested writes.',
    },
  }),
  customDefinitionCase({
    id: '004-overwrites-existing-branch',
    title: 'ResultPath overwrites an existing branch value with the new result',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'OverwriteBranch',
      States: {
        OverwriteBranch: {
          Type: 'Pass',
          Result: {
            status: 'replaced',
          },
          ResultPath: '$.detail',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-14',
      detail: {
        status: 'old',
        attempts: 2,
      },
      untouched: true,
    },
    expected: expectOutput({
      requestId: 'req-14',
      detail: {
        status: 'replaced',
      },
      untouched: true,
    }),
    source: {
      file: sourceFile,
      notes:
        'Shows replacement of an existing branch rather than deep merging the old and new values.',
    },
  }),
  customDefinitionCase({
    id: '005-invalid-path-fails',
    title: 'ResultPath fails when given an invalid JSONPath string',
    group,
    tags: ['negative', 'result_path', 'invalid_path'],
    definition: {
      StartAt: 'InvalidResultPath',
      States: {
        InvalidResultPath: {
          Type: 'Pass',
          Result: {
            unreachable: true,
          },
          ResultPath: 'not-a-path',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-15',
    },
    expected: expectFailure('States.ResultPathMatchFailure', 'not-a-path'),
    awsExecutable: false,
    skipReason:
      'Current local runtime now wraps invalid ResultPath application as States.ResultPathMatchFailure; AWS wording for this exact malformed path shape is still unobserved.',
    source: {
      file: sourceFile,
      notes:
        'Pins the current ResultPathMatchFailure wrapping behavior instead of surfacing the raw jsonpath parser error directly.',
    },
  }),
];
