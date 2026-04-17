import { expect } from 'vite-plus/test';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.WaitJsonata';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const featureWaitJsonataCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-seconds-jsonata-output',
    title: 'evaluates Wait.Seconds from a JSONata string and applies Wait.Output',
    group,
    tags: ['jsonata', 'wait', 'seconds', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'WaitForInputDelay',
      States: {
        WaitForInputDelay: {
          Type: 'Wait',
          Seconds: '{% $states.input.delaySeconds %}',
          Output: {
            delay: '{% $states.input.delaySeconds %}',
            requestId: '{% $states.input.requestId %}',
          },
          End: true,
        },
      },
    },
    input: {
      delaySeconds: 0,
      requestId: 'req-wait-seconds',
    },
    expected: expectOutput({
      delay: 0,
      requestId: 'req-wait-seconds',
    }),
  }),
  customDefinitionCase({
    id: '002-timestamp-jsonata-output',
    title: 'evaluates Wait.Timestamp from a JSONata string and can build output from state input',
    group,
    tags: ['jsonata', 'wait', 'timestamp', 'output'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'WaitUntilExpiry',
      States: {
        WaitUntilExpiry: {
          Type: 'Wait',
          Timestamp: '{% $states.input.expirydate %}',
          Output: '{% {"expiry": $states.input.expirydate, "kind": "timestamp"} %}',
          End: true,
        },
      },
    },
    input: {
      expirydate: '2020-01-01T00:00:00Z',
    },
    expected: expectOutput({
      expiry: '2020-01-01T00:00:00Z',
      kind: 'timestamp',
    }),
  }),
  customDefinitionCase({
    id: '003-state-level-querylanguage-overrides-machine-default',
    title: 'allows a Wait state to override the machine query language to JSONata',
    group,
    tags: ['jsonata', 'wait', 'query_language_override'],
    definition: {
      QueryLanguage: 'JSONPath',
      StartAt: 'JsonataWait',
      States: {
        JsonataWait: {
          Type: 'Wait',
          QueryLanguage: 'JSONata',
          Seconds: '{% 0 %}',
          Output: {
            mode: 'jsonata',
          },
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput({
      mode: 'jsonata',
    }),
  }),
];
