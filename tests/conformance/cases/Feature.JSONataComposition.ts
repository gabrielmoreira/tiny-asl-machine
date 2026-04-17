import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONataComposition';
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const featureJsonataCompositionCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-arguments-assign-output-compose-across-task-and-next-state',
    title: 'Task Arguments, Assign, and Output compose across a task state and the following state',
    group,
    tags: ['jsonata', 'composition', 'task', 'arguments', 'assign', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedPrefix',
      States: {
        SeedPrefix: {
          Type: 'Pass',
          Assign: {
            prefix: 'acct',
          },
          Next: 'InvokeCompose',
        },
        InvokeCompose: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'return { total: payload.left + payload.right, decorated: payload.label + ":" + (payload.left + payload.right) };',
              },
              payload: {
                left: '{% $states.input.left %}',
                right: '{% $states.input.right %}',
                label: '{% $prefix & "-" & $states.input.label %}',
              },
            },
          },
          Assign: {
            total: '{% $states.result.Payload.total %}',
            decorated: '{% $states.result.Payload.decorated %}',
          },
          Output: {
            requestId: '{% $states.input.requestId %}',
            rawDecorated: '{% $states.result.Payload.decorated %}',
            totalFromResult: '{% $states.result.Payload.total %}',
            decoratedFromResult: '{% $states.result.Payload.decorated %}',
            prefixSeen: '{% $prefix %}',
          },
          Next: 'Summarize',
        },
        Summarize: {
          Type: 'Pass',
          Output: {
            requestId: '{% $states.input.requestId %}',
            rawDecorated: '{% $states.input.rawDecorated %}',
            assignedDecorated: '{% $decorated %}',
            total: '{% $total %}',
            prefixSeen: '{% $states.input.prefixSeen %}',
          },
          End: true,
        },
      },
    },
    input: {
      left: 4,
      right: 5,
      label: 'invoice',
      requestId: 'req-jsonata-compose-1',
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: request => {
        const payload = (
          request as {
            Payload: { payload: { left: number; right: number; label: string } };
          }
        ).Payload.payload;

        return {
          Payload: {
            total: payload.left + payload.right,
            decorated: `${payload.label}:${payload.left + payload.right}`,
          },
          StatusCode: 200,
          ExecutedVersion: '$LATEST',
        };
      },
    }),
    expected: expectOutput({
      requestId: 'req-jsonata-compose-1',
      rawDecorated: 'acct-invoice:9',
      assignedDecorated: 'acct-invoice:9',
      total: 9,
      prefixSeen: 'acct',
    }),
    notes:
      'AWS-backed parity case for JSONata composition across Task Arguments, Assign, and Output. Uses the real Lambda wrapper shape in both AWS and local shims.',
  }),
  customDefinitionCase({
    id: '002-task-result-fed-into-assign-while-same-state-output-sees-entry-value',
    title:
      'Task result can feed Assign while same-state Output still sees the state-entry snapshot',
    group,
    tags: ['jsonata', 'composition', 'task', 'assign', 'output', 'evaluation_order'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedStage',
      States: {
        SeedStage: {
          Type: 'Pass',
          Assign: {
            stage: 'entry',
          },
          Next: 'Invoke',
        },
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'return { stage: "fresh", status: "done" };',
              },
              payload: {
                seed: '{% $stage %}',
              },
            },
          },
          Assign: {
            stage: '{% $states.result.Payload.stage %}',
            status: '{% $states.result.Payload.status %}',
          },
          Output: {
            stageSeenByOutput: '{% $stage %}',
            statusFromResult: '{% $states.result.Payload.status %}',
            nextStage: '{% $states.result.Payload.stage %}',
            nextStatus: '{% $states.result.Payload.status %}',
          },
          Next: 'Observe',
        },
        Observe: {
          Type: 'Pass',
          Output: {
            stage: '{% $stage %}',
            status: '{% $status %}',
            priorOutputStage: '{% $states.input.stageSeenByOutput %}',
            rawStatus: '{% $states.input.statusFromResult %}',
          },
          End: true,
        },
      },
    },
    input: {},
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: () => ({
        Payload: {
          stage: 'fresh',
          status: 'done',
        },
        StatusCode: 200,
        ExecutedVersion: '$LATEST',
      }),
    }),
    expected: expectOutput({
      stage: 'fresh',
      status: 'done',
      priorOutputStage: 'entry',
      rawStatus: 'done',
    }),
    notes:
      'AWS-backed parity case proving that Task result can feed Assign while same-state Output still sees the state-entry snapshot in JSONata composition.',
  }),
  customDefinitionCase({
    id: '003-catch-erroroutput-assign-and-output-compose-into-recovery-state',
    title: 'Catch can expose $states.errorOutput to both Assign and Output before recovery runs',
    group,
    tags: ['jsonata', 'composition', 'catch', 'error_output', 'assign', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'throw new Error("boom from composition");',
              },
              payload: '{% $states.input %}',
            },
          },
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              Assign: {
                caughtName: '{% $states.errorOutput.Error %}',
                caughtCause: '{% $states.errorOutput.Cause %}',
              },
              Output: {
                requestId: '{% $states.input.requestId %}',
                surfaced: '{% $states.errorOutput.Error %}',
              },
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Output: {
            requestId: '{% $states.input.requestId %}',
            surfaced: '{% $states.input.surfaced %}',
            caughtName: '{% $caughtName %}',
            causeIsString: '{% $type($caughtCause) = "string" %}',
          },
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-jsonata-compose-catch',
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: () => {
        throw new Error('boom from composition');
      },
    }),
    expected: expectOutput({
      requestId: 'req-jsonata-compose-catch',
      surfaced: 'Error',
      caughtName: 'Error',
      causeIsString: true,
    }),
  }),
  customDefinitionCase({
    id: '004-map-item-shaping-composes-with-outer-scope-and-post-map-summary',
    title: 'Map item shaping composes with outer-scope variables and a downstream JSONata summary',
    group,
    tags: ['jsonata', 'composition', 'map', 'itemselector', 'scope'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          Assign: {
            prefix: 'item',
          },
          Next: 'Iterate',
        },
        Iterate: {
          Type: 'Map',
          Items: '{% $states.input.values %}',
          ItemSelector: {
            idx: '{% $states.context.Map.Item.Index %}',
            value: '{% $states.context.Map.Item.Value %}',
            seenPrefix: '{% $prefix %}',
          },
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Prepare',
            States: {
              Prepare: {
                Type: 'Pass',
                Assign: {
                  localLabel: '{% $states.input.seenPrefix & "-" & $string($states.input.idx) %}',
                },
                Next: 'Emit',
              },
              Emit: {
                Type: 'Pass',
                Output:
                  '{% {"value": $states.input.value, "idx": $states.input.idx, "label": $localLabel, "outer": $states.input.seenPrefix} %}',
                End: true,
              },
            },
          },
          Next: 'Summarize',
        },
        Summarize: {
          Type: 'Pass',
          Output:
            '{% {"outer": $prefix, "count": $count($states.input), "results": $states.input} %}',
          End: true,
        },
      },
    },
    input: {
      values: ['a', 'b'],
    },
    expected: expectOutput({
      outer: 'item',
      count: 2,
      results: [
        { value: 'a', idx: 0, label: 'item-0', outer: 'item' },
        { value: 'b', idx: 1, label: 'item-1', outer: 'item' },
      ],
    }),
  }),
  customDefinitionCase({
    id: '005-parallel-branches-compose-branch-local-values-into-post-join-output',
    title:
      'Parallel branches can keep branch-local JSONata variables and feed a post-join output summary',
    group,
    tags: ['jsonata', 'composition', 'parallel', 'scope', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          Assign: {
            outer: 'shared',
          },
          Next: 'FanOut',
        },
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'PrepareA',
              States: {
                PrepareA: {
                  Type: 'Pass',
                  Assign: {
                    branchLocal: 'alpha',
                  },
                  Next: 'EmitA',
                },
                EmitA: {
                  Type: 'Pass',
                  Output: '{% {"branch": "A", "outer": $outer, "local": $branchLocal} %}',
                  End: true,
                },
              },
            },
            {
              StartAt: 'PrepareB',
              States: {
                PrepareB: {
                  Type: 'Pass',
                  Assign: {
                    branchLocal: 'beta',
                  },
                  Next: 'EmitB',
                },
                EmitB: {
                  Type: 'Pass',
                  Output: '{% {"branch": "B", "outer": $outer, "local": $branchLocal} %}',
                  End: true,
                },
              },
            },
          ],
          Output:
            '{% {"outer": $outer, "branchNames": [$states.result[0].branch, $states.result[1].branch], "locals": [$states.result[0].local, $states.result[1].local], "results": $states.result} %}',
          Next: 'Done',
        },
        Done: {
          Type: 'Pass',
          Output: '{% {"outer": $outer, "summary": $states.input} %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      outer: 'shared',
      summary: {
        outer: 'shared',
        branchNames: ['A', 'B'],
        locals: ['alpha', 'beta'],
        results: [
          { branch: 'A', outer: 'shared', local: 'alpha' },
          { branch: 'B', outer: 'shared', local: 'beta' },
        ],
      },
    }),
  }),
  customDefinitionCase({
    id: '006-parallel-branch-cannot-shadow-outer-variable-in-composed-flow',
    title: 'Parallel branch Assign cannot shadow an outer variable name in a composed JSONata flow',
    group,
    tags: ['jsonata', 'composition', 'parallel', 'scope', 'shadowing', 'validation'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          QueryLanguage: 'JSONata',
          Assign: {
            shared: 'outer',
          },
          Next: 'FanOut',
        },
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'Shadow',
              States: {
                Shadow: {
                  Type: 'Pass',
                  QueryLanguage: 'JSONata',
                  Assign: {
                    shared: 'inner',
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
    input: {},
    expected: expectValidationFailure(),
  }),
];
