import { expect } from 'vite-plus/test';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.TaskShapes';
const sourceFile = 'src/states/index.ts';
const localOnlySkipReason = 'Uses local task mocks to isolate raw Task result and error shapes.';
const localScalarResource = 'local:feature:task-shapes:scalar';
const localArrayResource = 'local:feature:task-shapes:array';
const localObjectResource = 'local:feature:task-shapes:object';
const localDiscardedResultResource = 'local:feature:task-shapes:discarded-result';
const localProjectedResultResource = 'local:feature:task-shapes:projected-result';
const localPlainErrorResource = 'local:feature:task-shapes:plain-error';
const localStructuredErrorResource = 'local:feature:task-shapes:structured-error';

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

export const featureTaskShapesCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-task-returns-scalar',
    title: 'task can return a scalar result without object normalization',
    group,
    tags: ['happy_path', 'task_shape', 'scalar', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localScalarResource,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-31',
    },
    setupLocalResources: () => ({
      [localScalarResource]: () => 7,
    }),
    expected: expectOutput(7),
    source: {
      file: sourceFile,
      notes:
        'Pins raw Task output passthrough for primitive results instead of assuming object-shaped payloads.',
    },
  }),
  customDefinitionCase({
    id: '002-task-returns-array',
    title: 'task can return an array result without wrapper normalization',
    group,
    tags: ['happy_path', 'task_shape', 'array', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localArrayResource,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-32',
    },
    setupLocalResources: () => ({
      [localArrayResource]: () => ['alpha', { code: 2 }, false],
    }),
    expected: expectOutput(['alpha', { code: 2 }, false]),
    source: {
      file: sourceFile,
      notes: 'Separates array passthrough from object-only happy-path coverage.',
    },
  }),
  customDefinitionCase({
    id: '003-task-returns-object',
    title: 'task can return a plain object result as the state output',
    group,
    tags: ['happy_path', 'task_shape', 'object', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localObjectResource,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-33',
    },
    setupLocalResources: () => ({
      [localObjectResource]: () => ({
        status: 'ok',
        metrics: {
          count: 2,
        },
      }),
    }),
    expected: expectOutput({
      status: 'ok',
      metrics: {
        count: 2,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps the suite explicit about the three core raw result classes: scalar, array, and object.',
    },
  }),
  customDefinitionCase({
    id: '004-task-resultpath-null-discards-result',
    title: 'Task ResultPath null preserves the original input and discards the task result',
    group,
    tags: ['happy_path', 'task_shape', 'result_path', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localDiscardedResultResource,
          ResultPath: null,
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-34',
      original: {
        keep: true,
      },
    },
    setupLocalResources: () => ({
      [localDiscardedResultResource]: () => ({
        computed: true,
        score: 99,
      }),
    }),
    expected: expectOutput({
      requestId: 'req-34',
      original: {
        keep: true,
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Shows ResultPath null behavior after a real Task invocation rather than a Pass-state synthetic result.',
    },
  }),
  customDefinitionCase({
    id: '005-task-outputpath-projects-subfield',
    title: 'Task OutputPath can project a nested subfield from the task result',
    group,
    tags: ['happy_path', 'task_shape', 'output_path', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localProjectedResultResource,
          OutputPath: '$.payload.customer',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-35',
    },
    setupLocalResources: () => ({
      [localProjectedResultResource]: () => ({
        payload: {
          customer: {
            id: 'cust-22',
            tier: 'pro',
          },
          audit: {
            accepted: true,
          },
        },
      }),
    }),
    expected: expectOutput({
      id: 'cust-22',
      tier: 'pro',
    }),
    source: {
      file: sourceFile,
      notes:
        'Keeps OutputPath coverage task-focused without involving ResultSelector or Parameters.',
    },
  }),
  customDefinitionCase({
    id: '006-task-plain-error-normalizes-name-and-cause',
    title: 'plain thrown Error surfaces its default name and message as task failure output',
    group,
    tags: ['negative', 'task_shape', 'error', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localPlainErrorResource,
          End: true,
        },
      },
    },
    input: {
      jobId: 'job-plain',
    },
    setupLocalResources: () => ({
      [localPlainErrorResource]: () => {
        throw new Error('plain task failure');
      },
    }),
    expected: expectFailure('Error', 'plain task failure'),
    source: {
      file: sourceFile,
      notes:
        'Characterizes how uncaught non-ExecutionError exceptions are surfaced through Task failure reporting.',
    },
  }),
  customDefinitionCase({
    id: '007-task-structured-error-preserves-code-and-cause',
    title: 'ExecutionError preserves its explicit code and message as task failure output',
    group,
    tags: ['negative', 'task_shape', 'error', 'local_only'],
    awsExecutable: false,
    skipReason: localOnlySkipReason,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localStructuredErrorResource,
          End: true,
        },
      },
    },
    input: {
      customerId: 'cust-9',
    },
    setupLocalResources: () => ({
      [localStructuredErrorResource]: payload => {
        const { customerId } = payload as { customerId: string };
        throw new ExecutionError('CustomerNotFound', `customer ${customerId} missing`);
      },
    }),
    expected: expectFailure('CustomerNotFound', 'customer cust-9 missing'),
    source: {
      file: sourceFile,
      notes:
        'Contrasts plain Error normalization with explicit ExecutionError code preservation for Task failures.',
    },
  }),
];
