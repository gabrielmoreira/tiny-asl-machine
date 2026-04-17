import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.IntrinsicComposition';
const sourceFile = 'src/states/index.ts';
const localComposedSelectorResource = 'arn:local:intrinsic-composition:selector';
const localFailingSelectorResource = 'arn:local:intrinsic-composition:failing-selector';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectFailure(error: string, causeIncludes?: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));

    if (causeIncludes) {
      expect(result.cause).toContain(causeIncludes);
    }
  };
}

export const featureIntrinsicCompositionCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-parameters-through-resultpath-and-outputpath',
    title: 'composes nested intrinsics in Parameters before ResultPath and OutputPath projection',
    group,
    tags: ['happy_path', 'parameters', 'result_path', 'output_path', 'nested'],
    definition: {
      StartAt: 'ComposeAudit',
      States: {
        ComposeAudit: {
          Type: 'Pass',
          InputPath: '$.request',
          Parameters: {
            audit: {
              'message.$':
                "States.Format('user:{} roles={}', $.user.id, States.JsonToString(States.Array($.roles[0], $.roles[1])))",
              'roleCount.$': 'States.ArrayLength($.roles)',
              'originalUser.$': '$.user',
            },
            trace: 'composed',
          },
          ResultPath: '$.analysis',
          OutputPath: '$.analysis.audit',
          End: true,
        },
      },
    },
    input: {
      request: {
        user: {
          id: 'user-7',
          tier: 'gold',
        },
        roles: ['admin', 'editor'],
        ignored: true,
      },
      outer: 'dropped-by-input-path',
    },
    expected: expectOutput({
      message: 'user:user-7 roles=["admin","editor"]',
      roleCount: 2,
      originalUser: {
        id: 'user-7',
        tier: 'gold',
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Pins the full classic ordering where InputPath narrows the payload, Parameters evaluates nested intrinsics, ResultPath stores that shaped value, and OutputPath projects the composed branch.',
    },
  }),
  customDefinitionCase({
    id: '002-resultselector-composes-intrinsics-before-final-projection',
    title:
      'composes intrinsics inside ResultSelector before ResultPath insertion and OutputPath projection',
    group,
    tags: ['happy_path', 'result_selector', 'result_path', 'output_path', 'nested'],
    definition: {
      StartAt: 'SelectComposedTaskResult',
      States: {
        SelectComposedTaskResult: {
          Type: 'Task',
          Resource: localComposedSelectorResource,
          ResultSelector: {
            overview: {
              'label.$': "States.Format('{}:{}', $.kind, States.JsonToString($.payload))",
              'tagCount.$': 'States.ArrayLength($.tags)',
              'payloadSnapshot.$': 'States.JsonToString($.payload)',
            },
            'firstTag.$': '$.tags[0]',
          },
          ResultPath: '$.task',
          OutputPath: '$.task.overview',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-31',
    },
    setupLocalResources: () => ({
      [localComposedSelectorResource]: () => ({
        kind: 'report',
        payload: {
          approved: true,
          pages: 4,
        },
        tags: ['hot', 'daily'],
      }),
    }),
    expected: expectOutput({
      label: 'report:{"approved":true,"pages":4}',
      tagCount: 2,
      payloadSnapshot: '{"approved":true,"pages":4}',
    }),
    awsExecutable: false,
    skipReason:
      'AWS validation currently rejects this local task-shaped ResultSelector composition probe; keep it local-only while task-backed selector coverage is modeled through the runtime harness.',
    source: {
      file: sourceFile,
      notes:
        'Shows that ResultSelector can evaluate nested intrinsic expressions against the raw task output before ResultPath and OutputPath consume the shaped selector result.',
    },
  }),
  customDefinitionCase({
    id: '003-nested-parameters-failure-surfaces-runtime-error',
    title:
      'surfaces a runtime error when a nested Parameters intrinsic produces the wrong type for its parent intrinsic',
    group,
    tags: ['negative', 'parameters', 'nested'],
    definition: {
      StartAt: 'FailNestedParameters',
      States: {
        FailNestedParameters: {
          Type: 'Pass',
          Parameters: {
            'value.$': 'States.ArrayLength(States.JsonToString($.items))',
          },
          End: true,
        },
      },
    },
    input: {
      items: [1, 2, 3],
    },
    expected: expectFailure('States.Runtime'),
    source: {
      file: sourceFile,
      notes:
        'Documents error propagation from a deeper intrinsic node when the nested JsonToString output is not a valid ArrayLength input.',
    },
  }),
  customDefinitionCase({
    id: '004-nested-resultselector-failure-surfaces-runtime-error',
    title:
      'surfaces a runtime error when a nested ResultSelector intrinsic fails during selector evaluation',
    group,
    tags: ['negative', 'result_selector', 'nested'],
    definition: {
      StartAt: 'FailNestedSelector',
      States: {
        FailNestedSelector: {
          Type: 'Task',
          Resource: localFailingSelectorResource,
          ResultSelector: {
            'broken.$': 'States.ArrayLength(States.JsonToString($.payload))',
          },
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-32',
    },
    setupLocalResources: () => ({
      [localFailingSelectorResource]: () => ({
        payload: {
          kind: 'not-an-array',
        },
      }),
    }),
    expected: expectFailure('States.Runtime'),
    awsExecutable: false,
    skipReason:
      'This pins local nested-intrinsic failure propagation inside a task-backed ResultSelector without asserting AWS parity for the harness-specific task setup yet.',
    source: {
      file: sourceFile,
      notes:
        'Covers the negative composition path where a nested intrinsic fails while ResultSelector is shaping the raw task result.',
    },
  }),
];
