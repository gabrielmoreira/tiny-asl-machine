import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.AssignVariables';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const featureAssignVariableCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-pass-assign-values-visible-in-next-state',
    title: 'Pass Assign values are visible in the next JSONata state',
    group,
    tags: ['assign', 'variables', 'jsonata'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedVehicle',
      States: {
        SeedVehicle: {
          Type: 'Pass',
          Assign: {
            make: 'Infiniti',
            model: 'G35',
            year: 2006,
          },
          Next: 'DescribeVehicle',
        },
        DescribeVehicle: {
          Type: 'Pass',
          Output: '{% $year & " " & $make & " " & $model %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput('2006 Infiniti G35'),
  }),
  customDefinitionCase({
    id: '002-assign-sees-state-entry-values-and-applies-next-state',
    title:
      'Assign expressions see state-entry variable values and new values appear only in the next state',
    group,
    tags: ['assign', 'variables', 'jsonata', 'state_entry_snapshot'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'SeedX',
      States: {
        SeedX: {
          Type: 'Pass',
          Assign: {
            x: 5,
          },
          Next: 'ReassignX',
        },
        ReassignX: {
          Type: 'Pass',
          Assign: {
            x: 42,
            newOrOld: '{% $x %}',
          },
          Next: 'ObserveAssignedValues',
        },
        ObserveAssignedValues: {
          Type: 'Pass',
          Output: {
            x: '{% $x %}',
            newOrOld: '{% $newOrOld %}',
          },
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      x: 42,
      newOrOld: 5,
    }),
  }),
  customDefinitionCase({
    id: '003-choice-rule-assign-visible-in-next-state',
    title: 'Choice rule Assign values are visible in the next state when the rule matches',
    group,
    tags: ['assign', 'variables', 'choice', 'jsonata'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Condition: '{% $states.input.value >= 20 and $states.input.value < 30 %}',
              Assign: {
                range: 'twenties',
              },
              Next: 'ReportRange',
            },
          ],
          Default: 'Fallback',
        },
        ReportRange: {
          Type: 'Pass',
          Output: '{% $range %}',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: { value: 23 },
    expected: expectOutput('twenties'),
  }),
  customDefinitionCase({
    id: '004-choice-state-assign-visible-on-default-path',
    title: 'Choice state Assign applies when no rule matches and default is taken',
    group,
    tags: ['assign', 'variables', 'choice', 'default_path'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Condition: '{% $states.input.value > 100 %}',
              Next: 'Unexpected',
            },
          ],
          Assign: {
            range: 'default',
          },
          Default: 'ReportRange',
        },
        Unexpected: {
          Type: 'Pass',
          End: true,
        },
        ReportRange: {
          Type: 'Pass',
          Output: '{% $range %}',
          End: true,
        },
      },
    },
    input: { value: 5 },
    expected: expectOutput('default'),
  }),
  customDefinitionCase({
    id: '005-catcher-assign-visible-in-next-state',
    title: 'Catcher Assign values are visible in the next state after error handling',
    group,
    tags: ['assign', 'variables', 'catch', 'jsonata'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'InvokeMissingService',
      States: {
        InvokeMissingService: {
          Type: 'Task',
          Resource: 'arn:aws:states:::aws-sdk:s3:headBucket',
          Arguments: {
            Bucket: 'tiny-asl-machine-observation-bucket-should-not-exist',
          },
          Catch: [
            {
              ErrorEquals: ['States.ALL'],
              Assign: {
                hasError: true,
              },
              Output: '{% $states.input %}',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Output: {
            hasError: '{% $hasError %}',
            requestId: '{% $states.input.requestId %}',
          },
          End: true,
        },
      },
    },
    input: { requestId: 'req-assign-catch' },
    setupLocalResources: () => ({
      'arn:aws:states:::aws-sdk:s3:headBucket': () => {
        throw new Error('local catch assign failure');
      },
    }),
    expected: expectOutput({
      hasError: true,
      requestId: 'req-assign-catch',
    }),
  }),
  customDefinitionCase({
    id: '006-map-iteration-scope-can-read-outer-and-keeps-inner-isolated',
    title: 'Map iterations can read outer variables and keep per-iteration inner scope isolated',
    group,
    tags: ['assign', 'variables', 'map', 'scope'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          QueryLanguage: 'JSONata',
          Assign: {
            outer: 'hello',
          },
          Next: 'GreetEach',
        },
        GreetEach: {
          Type: 'Map',
          ItemsPath: '$.items',
          Iterator: {
            StartAt: 'Prepare',
            States: {
              Prepare: {
                Type: 'Pass',
                QueryLanguage: 'JSONata',
                Assign: {
                  inner: '{% "item-" & $states.input %}',
                  seenOuter: '{% $outer %}',
                },
                Next: 'Emit',
              },
              Emit: {
                Type: 'Pass',
                QueryLanguage: 'JSONata',
                Output:
                  '{% {"input": $states.input, "outer": $outer, "inner": $inner, "seenOuter": $seenOuter} %}',
                End: true,
              },
            },
          },
          Next: 'Summarize',
        },
        Summarize: {
          Type: 'Pass',
          QueryLanguage: 'JSONata',
          Output: '{% {"outer": $outer, "results": $states.input} %}',
          End: true,
        },
      },
    },
    input: { items: [1, 2] },
    expected: expectOutput({
      outer: 'hello',
      results: [
        { input: 1, outer: 'hello', inner: 'item-1', seenOuter: 'hello' },
        { input: 2, outer: 'hello', inner: 'item-2', seenOuter: 'hello' },
      ],
    }),
  }),
  customDefinitionCase({
    id: '007-parallel-branches-can-read-outer-and-keep-branch-local-scope',
    title: 'Parallel branches can read outer variables while keeping branch-local scope isolated',
    group,
    tags: ['assign', 'variables', 'parallel', 'scope'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'SeedOuter',
      States: {
        SeedOuter: {
          Type: 'Pass',
          QueryLanguage: 'JSONata',
          Assign: {
            outer: 'hello',
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
                  QueryLanguage: 'JSONata',
                  Assign: {
                    inner: 'alpha',
                    seenOuter: '{% $outer %}',
                  },
                  Next: 'EmitA',
                },
                EmitA: {
                  Type: 'Pass',
                  QueryLanguage: 'JSONata',
                  Output:
                    '{% {"branch": "A", "outer": $outer, "inner": $inner, "seenOuter": $seenOuter} %}',
                  End: true,
                },
              },
            },
            {
              StartAt: 'PrepareB',
              States: {
                PrepareB: {
                  Type: 'Pass',
                  QueryLanguage: 'JSONata',
                  Assign: {
                    inner: 'beta',
                    seenOuter: '{% $outer %}',
                  },
                  Next: 'EmitB',
                },
                EmitB: {
                  Type: 'Pass',
                  QueryLanguage: 'JSONata',
                  Output:
                    '{% {"branch": "B", "outer": $outer, "inner": $inner, "seenOuter": $seenOuter} %}',
                  End: true,
                },
              },
            },
          ],
          Next: 'Summarize',
        },
        Summarize: {
          Type: 'Pass',
          QueryLanguage: 'JSONata',
          Output: '{% {"outer": $outer, "results": $states.input} %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      outer: 'hello',
      results: [
        { branch: 'A', outer: 'hello', inner: 'alpha', seenOuter: 'hello' },
        { branch: 'B', outer: 'hello', inner: 'beta', seenOuter: 'hello' },
      ],
    }),
  }),
  customDefinitionCase({
    id: '008-jsonata-parallel-output-can-read-result-array',
    title: 'JSONata Parallel Output can read the branch result array',
    group,
    tags: ['parallel', 'jsonata', 'output', 'typing'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'FanOut',
      States: {
        FanOut: {
          Type: 'Parallel',
          Branches: [
            {
              StartAt: 'EmitA',
              States: {
                EmitA: {
                  Type: 'Pass',
                  Output: '{% {"branch": "A"} %}',
                  End: true,
                },
              },
            },
            {
              StartAt: 'EmitB',
              States: {
                EmitB: {
                  Type: 'Pass',
                  Output: '{% {"branch": "B"} %}',
                  End: true,
                },
              },
            },
          ],
          Output: '{% {"count": $count($states.result), "results": $states.result} %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      count: 2,
      results: [{ branch: 'A' }, { branch: 'B' }],
    }),
  }),
];
