import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JsonataScopeSource';

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectFailureCode(code: string): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe(code);
    expect(result.cause).toEqual(expect.any(String));
  };
}

export const featureJsonataScopeSourceCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-map-inner-scope-cannot-shadow-outer-variable',
    title: 'Map inner scope cannot assign a variable name already assigned in an outer scope',
    group,
    tags: ['jsonata', 'scope', 'map', 'shadowing'],
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
          Next: 'Iterate',
        },
        Iterate: {
          Type: 'Map',
          ItemsPath: '$.items',
          Iterator: {
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
          End: true,
        },
      },
    },
    input: { items: [1] },
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '002-parallel-inner-scope-cannot-shadow-outer-variable',
    title: 'Parallel branch scope cannot assign a variable name already assigned in an outer scope',
    group,
    tags: ['jsonata', 'scope', 'parallel', 'shadowing'],
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
  customDefinitionCase({
    id: '003-map-itemselector-jsonata-reads-map-item-source-state-data',
    title:
      'Map ItemSelector can read Map.Item.Source as STATE_DATA for normal state-input iteration',
    group,
    tags: ['jsonata', 'map', 'itemselector', 'source'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Annotate',
      States: {
        Annotate: {
          Type: 'Map',
          Items: '{% $states.input.values %}',
          ItemSelector: {
            source: '{% $states.context.Map.Item.Source %}',
            value: '{% $states.context.Map.Item.Value %}',
          },
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Echo',
            States: {
              Echo: { Type: 'Pass', End: true },
            },
          },
          End: true,
        },
      },
    },
    input: { values: ['a', 'b'] },
    expected: expectFailureCode('States.QueryEvaluationError'),
  }),
];
