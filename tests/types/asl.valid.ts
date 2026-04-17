import type { StateDefinition } from '../../src';

export const jsonataParallelOutputDefinition: StateDefinition = {
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
};

export const machineTopLevelFieldsDefinition: StateDefinition = {
  Version: '1.0',
  TimeoutSeconds: 300,
  StartAt: 'Done',
  States: {
    Done: {
      Type: 'Succeed',
    },
  },
};

export const jsonataFailWithoutCauseDefinition: StateDefinition = {
  QueryLanguage: 'JSONata',
  StartAt: 'Stop',
  States: {
    Stop: {
      Type: 'Fail',
      Error: '{% "DynamicError" %}',
    },
  },
};

export const jsonpathFailWithPathFieldsDefinition: StateDefinition = {
  StartAt: 'Stop',
  States: {
    Stop: {
      Type: 'Fail',
      ErrorPath: '$.Error',
      CausePath: '$.Cause',
    },
  },
};

export const jsonpathPassResultDefinition: StateDefinition = {
  StartAt: 'Inject',
  States: {
    Inject: {
      Type: 'Pass',
      Result: {
        ok: true,
      },
      ResultPath: '$.meta',
      End: true,
    },
  },
};

void [
  jsonataParallelOutputDefinition,
  machineTopLevelFieldsDefinition,
  jsonataFailWithoutCauseDefinition,
  jsonpathFailWithPathFieldsDefinition,
  jsonpathPassResultDefinition,
];
