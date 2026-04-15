import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.MapJsonata';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const featureMapJsonataCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-items-jsonata-expression-selects-iteration-array',
    title: 'Map state Items JSONata expression selects the iteration array',
    group,
    tags: ['jsonata', 'map', 'items'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Iterate',
      States: {
        Iterate: {
          Type: 'Map',
          Items: '{% $states.input.elements %}',
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
    input: { elements: ['a', 'b', 'c'] },
    expected: expectOutput(['a', 'b', 'c']),
  }),

  customDefinitionCase({
    id: '002-items-static-array-literal',
    title: 'Map state Items accepts a static JSON array literal in JSONata mode',
    group,
    tags: ['jsonata', 'map', 'items', 'static'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Iterate',
      States: {
        Iterate: {
          Type: 'Map',
          Items: [10, 20, 30],
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Double',
            States: {
              Double: {
                Type: 'Pass',
                Output: '{% $states.input * $states.input %}',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput([100, 400, 900]),
  }),

  customDefinitionCase({
    id: '003-itemselector-jsonata-reads-map-item-index-and-value',
    title: 'Map state JSONata ItemSelector can access $states.context.Map.Item.Index and Value',
    group,
    tags: ['jsonata', 'map', 'itemselector', 'context'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Annotate',
      States: {
        Annotate: {
          Type: 'Map',
          Items: '{% $states.input.fruits %}',
          ItemSelector: {
            idx: '{% $states.context.Map.Item.Index %}',
            val: '{% $states.context.Map.Item.Value %}',
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
    input: { fruits: ['apple', 'banana', 'cherry'] },
    expected: expectOutput([
      { idx: 0, val: 'apple' },
      { idx: 1, val: 'banana' },
      { idx: 2, val: 'cherry' },
    ]),
  }),

  customDefinitionCase({
    id: '004-state-level-querylanguage-jsonata-map-with-items',
    title: 'Map state can override QueryLanguage to JSONata at state level with Items field',
    group,
    tags: ['jsonata', 'map', 'query_language_override', 'items'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'Iterate',
      States: {
        Iterate: {
          Type: 'Map',
          QueryLanguage: 'JSONata',
          Items: '{% $states.input.nums %}',
          ItemProcessor: {
            ProcessorConfig: { Mode: 'INLINE' },
            StartAt: 'Square',
            States: {
              Square: {
                Type: 'Pass',
                QueryLanguage: 'JSONata',
                Output: '{% $states.input * $states.input %}',
                End: true,
              },
            },
          },
          End: true,
        },
      },
    },
    input: { nums: [2, 3, 4] },
    expected: expectOutput([4, 9, 16]),
  }),
];
