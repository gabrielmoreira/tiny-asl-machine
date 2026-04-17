import type {
  JsonPathPassState,
  JsonPathTaskState,
  JsonataParallelState,
  JsonataTaskState,
} from '../../src';

export const invalidJsonPathPassResultSelector: JsonPathPassState = {
  Type: 'Pass',
  // @ts-expect-error ResultSelector is not valid on a JSONPath Pass state.
  ResultSelector: {
    wrapped: '$',
  },
  End: true,
};

export const invalidJsonataTaskInputPath: JsonataTaskState = {
  Type: 'Task',
  Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Example',
  // @ts-expect-error InputPath is not valid on a JSONata Task state.
  InputPath: '$.payload',
  End: true,
};

export const invalidJsonataParallelParameters: JsonataParallelState = {
  Type: 'Parallel',
  Branches: [
    {
      StartAt: 'Done',
      States: {
        Done: {
          Type: 'Succeed',
        },
      },
    },
  ],
  // @ts-expect-error Parameters is not valid on a JSONata Parallel state.
  Parameters: {
    payload: true,
  },
  End: true,
};

export const invalidJsonPathCatcherOutput: JsonPathTaskState = {
  Type: 'Task',
  Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Example',
  Catch: [
    {
      ErrorEquals: ['States.ALL'],
      // @ts-expect-error Output is not valid on a JSONPath Catcher.
      Output: '{% $states.errorOutput %}',
      Next: 'Recovered',
    },
  ],
  End: true,
};

void [
  invalidJsonPathPassResultSelector,
  invalidJsonataTaskInputPath,
  invalidJsonataParallelParameters,
  invalidJsonPathCatcherOutput,
];
