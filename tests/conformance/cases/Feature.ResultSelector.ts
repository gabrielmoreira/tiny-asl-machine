import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.ResultSelector';
const sourceFile = 'src/states/index.ts';
const localShapeResultResource = 'arn:local:result-selector:shape-result';
const localCaptureRawResultResource = 'arn:local:result-selector:capture-raw-result';
const localNormalizeTaskResultResource = 'arn:local:result-selector:normalize-task-result';
const localInvalidSelectorResource = 'arn:local:result-selector:invalid-selector';

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

export const featureResultSelectorCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-reshapes-raw-result',
    title: 'ResultSelector reshapes the raw state result into a new object',
    group,
    tags: ['happy_path', 'result_selector'],
    definition: {
      StartAt: 'ShapeResult',
      States: {
        ShapeResult: {
          Type: 'Task',
          Resource: localShapeResultResource,
          ResultSelector: {
            job: {
              'id.$': '$.identity.id',
              'durationMs.$': '$.metrics.durationMs',
            },
            'firstFlag.$': '$.flags[0]',
            source: 'result-selector',
          },
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-1',
    },
    setupLocalResources: () => ({
      [localShapeResultResource]: () => ({
        identity: {
          id: 'job-7',
          source: 'sync',
        },
        metrics: {
          durationMs: 12,
          retries: 1,
        },
        flags: ['hot', 'new'],
      }),
    }),
    expected: expectOutput({
      job: {
        id: 'job-7',
        durationMs: 12,
      },
      firstFlag: 'hot',
      source: 'result-selector',
    }),
    awsExecutable: false,
    skipReason:
      'AWS validation currently rejects this local task-shaped ResultSelector probe; keep it local-only while task coverage is modeled through the runtime harness.',
    source: {
      file: sourceFile,
      notes:
        'Directly targets buildResultSelector by reshaping the raw task result before any ResultPath or OutputPath processing.',
    },
  }),
  customDefinitionCase({
    id: '002-selects-from-entire-raw-result',
    title: 'ResultSelector can select both nested fields and the entire raw result',
    group,
    tags: ['happy_path', 'result_selector'],
    definition: {
      StartAt: 'CaptureRawResult',
      States: {
        CaptureRawResult: {
          Type: 'Task',
          Resource: localCaptureRawResultResource,
          ResultSelector: {
            response: {
              'payload.$': '$.payload',
              'code.$': '$.statusCode',
            },
            'raw.$': '$',
          },
          End: true,
        },
      },
    },
    input: {
      ignored: true,
    },
    setupLocalResources: () => ({
      [localCaptureRawResultResource]: () => ({
        statusCode: 200,
        payload: {
          approved: true,
          reviewer: 'ada',
        },
      }),
    }),
    expected: expectOutput({
      response: {
        payload: {
          approved: true,
          reviewer: 'ada',
        },
        code: 200,
      },
      raw: {
        statusCode: 200,
        payload: {
          approved: true,
          reviewer: 'ada',
        },
      },
    }),
    awsExecutable: false,
    skipReason:
      'AWS validation currently rejects this local task-shaped ResultSelector probe; keep it local-only while task coverage is modeled through the runtime harness.',
    source: {
      file: sourceFile,
      notes:
        'Shows that ResultSelector reads from the task output object itself, including the root $ selection.',
    },
  }),
  customDefinitionCase({
    id: '003-shapes-before-resultpath',
    title: 'ResultSelector shapes data before ResultPath writes it into the parent input',
    group,
    tags: ['happy_path', 'result_selector', 'result_path'],
    definition: {
      StartAt: 'NormalizeTaskResult',
      States: {
        NormalizeTaskResult: {
          Type: 'Task',
          Resource: localNormalizeTaskResultResource,
          ResultSelector: {
            summary: {
              'id.$': '$.rawId',
              'pages.$': '$.stats.pages',
            },
            kind: 'normalized',
          },
          ResultPath: '$.task',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-9',
      original: true,
    },
    setupLocalResources: () => ({
      [localNormalizeTaskResultResource]: () => ({
        rawId: 'report-9',
        stats: {
          pages: 4,
        },
        debug: {
          traceId: 'trace-77',
        },
      }),
    }),
    expected: expectOutput({
      requestId: 'req-9',
      original: true,
      task: {
        summary: {
          id: 'report-9',
          pages: 4,
        },
        kind: 'normalized',
      },
    }),
    awsExecutable: false,
    skipReason:
      'AWS validation currently rejects this local task-shaped ResultSelector probe; keep it local-only while task coverage is modeled through the runtime harness.',
    source: {
      file: sourceFile,
      notes:
        'Keeps the distinction clear: ResultSelector shapes the task result, then ResultPath inserts that shaped value into the input.',
    },
  }),
  customDefinitionCase({
    id: '004-invalid-selector-path-fails',
    title: 'ResultSelector fails when one of its JSONPath expressions is invalid',
    group,
    tags: ['negative', 'result_selector', 'invalid_path'],
    definition: {
      StartAt: 'InvalidSelector',
      States: {
        InvalidSelector: {
          Type: 'Task',
          Resource: localInvalidSelectorResource,
          ResultSelector: {
            'value.$': 'not-a-path',
          },
          End: true,
        },
      },
    },
    input: {},
    setupLocalResources: () => ({
      [localInvalidSelectorResource]: () => ({
        ok: true,
      }),
    }),
    expected: expectFailure('States.Runtime', 'Invalid intrinsic invocation'),
    awsExecutable: false,
    skipReason:
      'This pins current local invalid-JSONPath failure behavior for ResultSelector without asserting AWS error naming or wording parity yet.',
    source: {
      file: sourceFile,
      notes:
        'Documents the present runtime behavior where invalid selector syntax surfaces directly from JSONPath parsing.',
    },
  }),
];
