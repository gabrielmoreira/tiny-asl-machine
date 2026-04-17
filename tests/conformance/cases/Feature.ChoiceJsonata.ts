import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.ChoiceJsonata';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const featureChoiceJsonataCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-choice-rule-output-when-condition-matches',
    title: 'uses Choice rule Output when a JSONata Condition matches',
    group,
    tags: ['jsonata', 'choice', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Condition: '{% $states.input.rating >= $states.input.auditThreshold %}',
              Output: {
                excess: '{% $states.input.rating - $states.input.auditThreshold %}',
              },
              Next: 'Done',
            },
          ],
          Default: 'Fallback',
        },
        Done: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {
      rating: 17,
      auditThreshold: 10,
    },
    expected: expectOutput({
      excess: 7,
    }),
  }),
  customDefinitionCase({
    id: '002-choice-state-output-on-default-path',
    title: 'uses Choice state Output when no JSONata rule matches',
    group,
    tags: ['jsonata', 'choice', 'default_output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Condition: '{% $states.input.type = "Private" %}',
              Next: 'Private',
            },
          ],
          Output: {
            route: 'default',
            requestId: '{% $states.input.requestId %}',
          },
          Default: 'Fallback',
        },
        Private: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {
      type: 'Public',
      requestId: 'req-choice-default',
    },
    expected: expectOutput({
      route: 'default',
      requestId: 'req-choice-default',
    }),
  }),
  customDefinitionCase({
    id: '003-state-level-querylanguage-overrides-machine-default',
    title: 'allows a Choice state to override the machine query language to JSONata',
    group,
    tags: ['jsonata', 'choice', 'query_language_override'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          QueryLanguage: 'JSONata',
          Choices: [
            {
              Condition: '{% $states.input.total > 10 %}',
              Output: {
                bucket: 'large',
              },
              Next: 'Done',
            },
          ],
          Default: 'Fallback',
        },
        Done: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: {
      total: 15,
    },
    expected: expectOutput({
      bucket: 'large',
    }),
  }),
  customDefinitionCase({
    id: '004-choice-rule-empty-string-output-is-honored',
    title: 'uses explicit empty-string Choice rule Output when a JSONata Condition matches',
    group,
    tags: ['jsonata', 'choice', 'output', 'empty_string'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Dispatch',
      States: {
        Dispatch: {
          Type: 'Choice',
          Choices: [
            {
              Condition: '{% true %}',
              Output: '',
              Next: 'Done',
            },
          ],
          Default: 'Fallback',
        },
        Done: {
          Type: 'Pass',
          End: true,
        },
        Fallback: {
          Type: 'Pass',
          End: true,
        },
      },
    },
    input: { requestId: 'req-choice-empty-output' },
    expected: expectOutput(''),
  }),
];
