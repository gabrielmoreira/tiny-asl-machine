import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Map.State';
const awsLambdaInvokeWaitForTaskTokenResource = 'arn:aws:states:::lambda:invoke.waitForTaskToken';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';
const sourceFile = 'src/states/index.spec.ts';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectOutputShape(
  shape: Record<string, unknown> | unknown[]
): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toMatchObject(shape);
  };
}

function expectFailure(error: string, causeParts: string[] = []): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(error);
    expect(result.cause).toEqual(expect.any(String));

    for (const causePart of causeParts) {
      expect(result.cause).toContain(causePart);
    }
  };
}

export const mapStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-items-path-selects-array',
    title: 'ItemsPath selects the iteration array from parent input',
    group,
    tags: ['happy_path', 'items_path'],
    definition: {
      StartAt: 'IterateSelected',
      States: {
        IterateSelected: {
          Type: 'Map',
          ItemsPath: '$.selected',
          Iterator: {
            StartAt: 'ReturnItem',
            States: {
              ReturnItem: {
                Type: 'Pass',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      selected: ['sku-1', 'sku-2', 'sku-3'],
      ignored: ['skip-me'],
    },
    expected: expectOutput(['sku-1', 'sku-2', 'sku-3']),
    source: {
      file: sourceFile,
      notes:
        'Extends the existing Map-state coverage with a compact ItemsPath-focused conformance case.',
    },
  }),
  customDefinitionCase({
    id: '002-iterator-without-parameters-gets-raw-item',
    title: 'Iterator without Parameters receives each raw item as its input',
    group,
    tags: ['happy_path', 'iterator_input', 'local_only'],
    definition: {
      StartAt: 'IterateOrders',
      States: {
        IterateOrders: {
          Type: 'Map',
          ItemsPath: '$.orders',
          Iterator: {
            StartAt: 'EchoOrder',
            States: {
              EchoOrder: {
                Type: 'Task',
                Resource: 'arn:local:map:echo-order',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      batch: 'north-1',
      orders: [
        { sku: 'A-1', quantity: 2 },
        { sku: 'B-9', quantity: 1 },
      ],
    },
    expected: expectOutput([
      { sku: 'A-1', quantity: 2 },
      { sku: 'B-9', quantity: 1 },
    ]),
    awsExecutable: false,
    skipReason:
      'Uses a local-only echo task resource so the case can assert iterator input semantics deterministically.',
    setupLocalResources: () => ({
      'arn:local:map:echo-order': payload => payload,
    }),
    source: {
      file: sourceFile,
      notes:
        'Uses setupLocalResources to validate raw-item iterator input without depending on external services.',
    },
  }),
  customDefinitionCase({
    id: '003-iterator-parameters-can-read-map-context',
    title: 'Iterator Parameters can read $$.Map.Item.Index and $$.Map.Item.Value',
    group,
    tags: ['happy_path', 'context', 'parameters', 'local_only'],
    definition: {
      StartAt: 'AnnotateItems',
      States: {
        AnnotateItems: {
          Type: 'Map',
          ItemsPath: '$.colors',
          Parameters: {
            'position.$': '$$.Map.Item.Index',
            'color.$': '$$.Map.Item.Value',
            'region.$': '$.region',
          },
          Iterator: {
            StartAt: 'EchoAnnotatedItem',
            States: {
              EchoAnnotatedItem: {
                Type: 'Task',
                Resource: 'arn:local:map:echo-annotated-item',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      region: 'eu-west-1',
      colors: ['red', 'blue', 'green'],
    },
    expected: expectOutput([
      { position: 0, color: 'red', region: 'eu-west-1' },
      { position: 1, color: 'blue', region: 'eu-west-1' },
      { position: 2, color: 'green', region: 'eu-west-1' },
    ]),
    awsExecutable: false,
    skipReason:
      'Uses a local-only echo task resource while cataloging map-context parameter semantics.',
    setupLocalResources: () => ({
      'arn:local:map:echo-annotated-item': payload => payload,
    }),
    source: {
      file: sourceFile,
      notes:
        'Builds on the existing Map Parameters example by asserting both Map item context fields together.',
    },
  }),
  customDefinitionCase({
    id: '004-result-path-writes-produced-array',
    title: 'ResultPath writes the produced array back into the parent input',
    group,
    tags: ['happy_path', 'result_path'],
    definition: {
      StartAt: 'Summarize',
      States: {
        Summarize: {
          Type: 'Map',
          ItemsPath: '$.todo',
          ResultPath: '$.summary.processed',
          Iterator: {
            StartAt: 'ProjectTask',
            States: {
              ProjectTask: {
                Type: 'Pass',
                Parameters: {
                  'task.$': '$.task',
                  'completed.$': '$.done',
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
      requestId: 'req-7',
      todo: [
        { task: 'pack', done: false },
        { task: 'ship', done: true },
      ],
      summary: {
        count: 2,
      },
    },
    expected: expectOutput({
      requestId: 'req-7',
      todo: [
        { task: 'pack', done: false },
        { task: 'ship', done: true },
      ],
      summary: {
        count: 2,
        processed: [
          { task: 'pack', completed: false },
          { task: 'ship', completed: true },
        ],
      },
    }),
    source: {
      file: sourceFile,
      notes:
        'Captures parent-input preservation plus nested ResultPath replacement in one readable case.',
    },
  }),
  customDefinitionCase({
    id: '005-non-array-map-input-fails',
    title: 'Map state fails when ItemsPath resolves to a non-array value',
    group,
    tags: ['negative', 'items_path', 'type_validation'],
    definition: {
      StartAt: 'IterateInvalid',
      States: {
        IterateInvalid: {
          Type: 'Map',
          ItemsPath: '$.notAList',
          Iterator: {
            StartAt: 'ReturnItem',
            States: {
              ReturnItem: {
                Type: 'Pass',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      notAList: {
        sku: 'only-one',
      },
    },
    expected: expectFailure('InvalidMapInput', ['array']),
    awsExecutable: false,
    skipReason:
      'Retained as a local conformance failure until AWS execution-error wording is captured authoritatively.',
    source: {
      file: sourceFile,
      notes: 'Matches the runtime guard that rejects non-array Map inputs before iteration begins.',
    },
  }),
  customDefinitionCase({
    id: '007-local-map-item-context-projection',
    title: 'projects Map item context, execution input, and task token in a local iterator task',
    group,
    tags: ['happy_path', 'context', 'map', 'task_token', 'local_only'],
    awsExecutable: false,
    definition: {
      StartAt: 'Iterate',
      States: {
        Iterate: {
          Type: 'Map',
          ItemsPath: '$.items',
          Parameters: {
            'index.$': '$$.Map.Item.Index',
            'value.$': '$$.Map.Item.Value',
            'executionInput.$': '$$.Execution.Input',
          },
          Iterator: {
            StartAt: 'Probe',
            States: {
              Probe: {
                Type: 'Task',
                Resource: 'arn:local:map:context-probe',
                Parameters: {
                  'payload.$': '$',
                  'taskToken.$': '$$.Task.Token',
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
      items: [
        { color: 'red', weight: 1 },
        { color: 'blue', weight: 2 },
      ],
    },
    setupLocalResources: () => ({
      'arn:local:map:context-probe': payload => payload,
    }),
    expected: expectOutputShape([
      {
        payload: {
          index: 0,
          value: { color: 'red', weight: 1 },
          executionInput: {
            items: [
              { color: 'red', weight: 1 },
              { color: 'blue', weight: 2 },
            ],
          },
        },
        taskToken: expect.stringContaining('TaskToken-'),
      },
      {
        payload: {
          index: 1,
          value: { color: 'blue', weight: 2 },
          executionInput: {
            items: [
              { color: 'red', weight: 1 },
              { color: 'blue', weight: 2 },
            ],
          },
        },
        taskToken: expect.stringContaining('TaskToken-'),
      },
    ]),
    notes:
      'Local mirror of the AWS Map context observation. Extends existing local Map coverage from item index/value into execution input and per-task token projection.',
  }),
  customDefinitionCase({
    id: '006-aws-map-item-context-observation',
    title: 'observes Map item context through Lambda callback',
    group,
    tags: ['aws_only', 'aws_observation', 'map', 'context', 'task_token'],
    localExecutable: false,
    definition: {
      StartAt: 'Iterate',
      States: {
        Iterate: {
          Type: 'Map',
          ItemsPath: '$.items',
          Parameters: {
            'index.$': '$$.Map.Item.Index',
            'value.$': '$$.Map.Item.Value',
            'executionInput.$': '$$.Execution.Input',
          },
          Iterator: {
            StartAt: 'Probe',
            States: {
              Probe: {
                Type: 'Task',
                Resource: awsLambdaInvokeWaitForTaskTokenResource,
                Parameters: {
                  FunctionName: awsLambdaFixtureArn,
                  Payload: {
                    config: {
                      script:
                        'const sfn = new aws.sfn.SFNClient({}); await sfn.send(new aws.sfn.SendTaskSuccessCommand({ taskToken, output: JSON.stringify({ payload, event, taskTokenVar: taskToken }) })); return { callbackSent: true };',
                    },
                    'payload.$': '$',
                    'taskToken.$': '$$.Task.Token',
                  },
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
      items: [
        { color: 'red', weight: 1 },
        { color: 'blue', weight: 2 },
      ],
    },
    expected: expectOutputShape([
      {
        payload: {
          index: 0,
          value: { color: 'red', weight: 1 },
          executionInput: {
            items: [
              { color: 'red', weight: 1 },
              { color: 'blue', weight: 2 },
            ],
          },
        },
        event: {
          payload: {
            index: 0,
            value: { color: 'red', weight: 1 },
            executionInput: {
              items: [
                { color: 'red', weight: 1 },
                { color: 'blue', weight: 2 },
              ],
            },
          },
          taskToken: expect.any(String),
        },
        taskTokenVar: expect.any(String),
      },
      {
        payload: {
          index: 1,
          value: { color: 'blue', weight: 2 },
          executionInput: {
            items: [
              { color: 'red', weight: 1 },
              { color: 'blue', weight: 2 },
            ],
          },
        },
        event: {
          payload: {
            index: 1,
            value: { color: 'blue', weight: 2 },
            executionInput: {
              items: [
                { color: 'red', weight: 1 },
                { color: 'blue', weight: 2 },
              ],
            },
          },
          taskToken: expect.any(String),
        },
        taskTokenVar: expect.any(String),
      },
    ]),
    notes:
      'AWS-only observation case. Confirms that Map iterator context is available to callback Lambda tasks through JSONPath context selectors.',
  }),
  customDefinitionCase({
    id: '008-item-selector-shapes-each-iteration-input',
    title: 'ItemSelector shapes each iteration input before entering the iterator',
    group,
    tags: ['happy_path', 'item_selector', 'map'],
    definition: {
      StartAt: 'AnnotateItems',
      States: {
        AnnotateItems: {
          Type: 'Map',
          ItemsPath: '$.colors',
          ItemSelector: {
            'position.$': '$$.Map.Item.Index',
            'color.$': '$$.Map.Item.Value',
            'region.$': '$.region',
          },
          Iterator: {
            StartAt: 'EchoAnnotatedItem',
            States: {
              EchoAnnotatedItem: {
                Type: 'Pass',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      region: 'eu-west-1',
      colors: ['red', 'blue', 'green'],
    },
    expected: expectOutput([
      { position: 0, color: 'red', region: 'eu-west-1' },
      { position: 1, color: 'blue', region: 'eu-west-1' },
      { position: 2, color: 'green', region: 'eu-west-1' },
    ]),
    notes:
      'Tests the modern Map ItemSelector field directly. This should match the existing Parameters-based shaping case while using the newer ASL surface.',
  }),
  customDefinitionCase({
    id: '009-item-selector-takes-precedence-over-parameters',
    title: 'ItemSelector takes precedence over deprecated Parameters on Map',
    group,
    awsExecutable: false,
    skipReason:
      'AWS validation rejects the deprecated Parameters field when ItemSelector is also present, so precedence is asserted locally as a runtime-compatibility guard only.',
    tags: ['happy_path', 'item_selector', 'parameters', 'precedence'],
    definition: {
      StartAt: 'AnnotateItems',
      States: {
        AnnotateItems: {
          Type: 'Map',
          ItemsPath: '$.colors',
          Parameters: {
            ignored: true,
            'region.$': '$.wrongRegion',
          },
          ItemSelector: {
            'position.$': '$$.Map.Item.Index',
            'color.$': '$$.Map.Item.Value',
            'region.$': '$.region',
          },
          Iterator: {
            StartAt: 'EchoAnnotatedItem',
            States: {
              EchoAnnotatedItem: {
                Type: 'Pass',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {
      region: 'eu-west-1',
      wrongRegion: 'should-not-appear',
      colors: ['red', 'blue'],
    },
    expected: expectOutput([
      { position: 0, color: 'red', region: 'eu-west-1' },
      { position: 1, color: 'blue', region: 'eu-west-1' },
    ]),
    notes:
      'Guards the precedence rule in processMapState: ItemSelector must win when both ItemSelector and deprecated Parameters are present.',
  }),
  (() => {
    let active = 0;
    let maxSeen = 0;

    return customDefinitionCase({
      id: '010-max-concurrency-path-limits-parallelism',
      title: 'MaxConcurrencyPath limits local Map parallelism using parent input',
      group,
      tags: ['map', 'max_concurrency_path', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Asserts local concurrency scheduling directly via a closure-backed resource handler; kept local-only for deterministic overlap observation.',
      definition: {
        StartAt: 'Iterate',
        States: {
          Iterate: {
            Type: 'Map',
            ItemsPath: '$.items',
            MaxConcurrencyPath: '$.limits.map',
            Iterator: {
              StartAt: 'Observe',
              States: {
                Observe: {
                  Type: 'Task',
                  Resource: 'arn:local:map:max-concurrency',
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      },
      input: {
        items: [1, 2, 3],
        limits: { map: 1 },
      },
      setupLocalResources: () => ({
        'arn:local:map:max-concurrency': async payload => {
          active += 1;
          maxSeen = Math.max(maxSeen, active);
          await Promise.resolve();
          active -= 1;
          return payload;
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual([1, 2, 3]);
        expect(maxSeen).toBe(1);
      },
      notes:
        'Without MaxConcurrencyPath support this case will usually observe overlap (>1 active handler at once).',
    });
  })(),
  (() => {
    let active = 0;
    let maxSeen = 0;

    return customDefinitionCase({
      id: '011-max-concurrency-literal-takes-precedence-over-path',
      title: 'MaxConcurrency literal takes precedence over MaxConcurrencyPath',
      group,
      tags: ['map', 'max_concurrency', 'precedence', 'local_only'],
      awsExecutable: false,
      skipReason:
        'Asserts local concurrency scheduling directly via a closure-backed resource handler to verify precedence when both fields are present.',
      definition: {
        StartAt: 'Iterate',
        States: {
          Iterate: {
            Type: 'Map',
            ItemsPath: '$.items',
            MaxConcurrency: 1,
            MaxConcurrencyPath: '$.limits.map',
            Iterator: {
              StartAt: 'Observe',
              States: {
                Observe: {
                  Type: 'Task',
                  Resource: 'arn:local:map:max-concurrency-precedence',
                  End: true,
                },
              },
            },
            End: true,
          },
        },
      } as unknown as ConformanceCase['definition'],
      input: {
        items: [1, 2, 3],
        limits: { map: 3 },
      },
      setupLocalResources: () => ({
        'arn:local:map:max-concurrency-precedence': async payload => {
          active += 1;
          maxSeen = Math.max(maxSeen, active);
          await Promise.resolve();
          active -= 1;
          return payload;
        },
      }),
      expected: result => {
        expect(result.error).toBeUndefined();
        expect(result.cause).toBeUndefined();
        expect(result.output).toStrictEqual([1, 2, 3]);
        expect(maxSeen).toBe(1);
      },
      notes:
        'Regression guard for getMapMaxConcurrency precedence: the literal field must win over the path-driven field when both are present.',
    });
  })(),
];
