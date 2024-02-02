/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Context, State, StateDefinition } from '../../types';
import { run, runState } from './index';
import { ExecutionError } from '../utils/executionError';

describe('runState', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('runs a Task state', async () => {
    // Given
    const state: State = {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Echo',
      InputPath: '$.a',
      Parameters: {
        a: true,
        b: 1,
        'c.$': '$',
      },
      ResultSelector: {
        crazy: {
          a: false,
          'b.$': '$.b',
          'd.$': '$.c',
          'payload.$': '$',
        },
      },
      ResultPath: '$.testing',
      OutputPath: '$.testing.crazy',
      End: true,
    };
    const context = (<Context>{
      Resources: {
        invoke: async (resource: string, payload: unknown) =>
          typeof payload !== 'object'
            ? payload
            : {
                ...payload,
                itWorks: true,
                invokedResourceName: resource,
              },
      },
    }) as unknown as Context;
    // When
    const result = await runState(context, state, { a: [1, 2, 3, 4] });
    // Then
    expect(result).toStrictEqual({
      a: false,
      b: 1,
      d: [1, 2, 3, 4],
      payload: {
        a: true,
        b: 1,
        c: [1, 2, 3, 4],
        itWorks: true,
        invokedResourceName: 'arn:aws:lambda:us-east-1:123456789012:function:Echo',
      },
    });
    expect(context.Transition).toStrictEqual({ End: true });
  });
  it('runs a Pass state', async () => {
    // Given
    const state: State = {
      Type: 'Pass',
      InputPath: '$.a',
      Parameters: {
        a: true,
        b: 1,
        'c.$': '$',
      },
      ResultSelector: {
        crazy: {
          a: false,
          'b.$': '$.b',
          'd.$': '$.c',
          'payload.$': '$',
        },
      },
      ResultPath: '$.testing',
      OutputPath: '$.testing.crazy',
      Next: 'SomeNextState',
    };
    const context = (<Context>{}) as unknown as Context;
    // When
    const result = await runState(context, state, { a: [1, 2, 3, 4] });
    // Then
    expect(result).toStrictEqual({
      a: false,
      b: 1,
      d: [1, 2, 3, 4],
      payload: { a: true, b: 1, c: [1, 2, 3, 4] },
    });
    expect(context.Transition).toStrictEqual({ Next: 'SomeNextState' });
  });
  it('runs a Choice state', async () => {
    // Given
    const state: State = {
      Type: 'Choice',
      Choices: [
        {
          Not: {
            Variable: '$.type',
            StringEquals: 'Private',
          },
          Next: 'Public',
        },
        {
          Variable: '$.value',
          NumericEquals: 0,
          Next: 'ValueIsZero',
        },
        {
          And: [
            {
              Variable: '$.value',
              NumericGreaterThanEquals: 20,
            },
            {
              Variable: '$.value',
              NumericLessThan: 30,
            },
          ],
          Next: 'ValueInTwenties',
        },
      ],
      Default: 'DefaultState',
    };
    const context1 = (<Context>{}) as unknown as Context;
    const context2 = (<Context>{}) as unknown as Context;
    const context3 = (<Context>{}) as unknown as Context;
    const context4 = (<Context>{}) as unknown as Context;
    // When
    const result1 = await runState(context1, state, {
      type: 'Private',
      value: 22,
    });
    const result2 = await runState(context2, state, {
      type: 'Public',
      value: 22,
    });
    const result3 = await runState(context3, state, {
      type: 'Private',
      value: 19,
    });
    const result4 = await runState(context4, state, {
      type: 'Private',
      value: 40,
    });
    // Then
    expect(result1).toStrictEqual({
      type: 'Private',
      value: 22,
    });
    expect(context1.Transition).toStrictEqual({ Next: 'ValueInTwenties' });
    expect(result2).toStrictEqual({
      type: 'Public',
      value: 22,
    });
    expect(context2.Transition).toStrictEqual({ Next: 'Public' });
    expect(result3).toStrictEqual({
      type: 'Private',
      value: 19,
    });
    expect(context3.Transition).toStrictEqual({ Next: 'DefaultState' });
    expect(result4).toStrictEqual({
      type: 'Private',
      value: 40,
    });
    expect(context4.Transition).toStrictEqual({ Next: 'DefaultState' });
  });
  it('runs a Choice state (without Default)', async () => {
    // Given
    const state: State = {
      Type: 'Choice',
      Choices: [
        {
          Not: {
            Variable: '$.type',
            StringEquals: 'Private',
          },
          Next: 'Public',
        },
        {
          Variable: '$.value',
          NumericEquals: 0,
          Next: 'ValueIsZero',
        },
        {
          And: [
            {
              Variable: '$.value',
              NumericGreaterThanEquals: 20,
            },
            {
              Variable: '$.value',
              NumericLessThan: 30,
            },
          ],
          Next: 'ValueInTwenties',
        },
      ],
    };
    const context = (<Context>{}) as unknown as Context;
    // When
    let error: any;
    try {
      await runState(context, state, {
        type: 'Private',
        value: 19,
      });
    } catch (e) {
      error = e;
    }
    // Then
    expect(error?.name).toBe('States.NoChoiceMatched');
  });
  it('runs a Parallel state', async () => {
    // Given
    const state: State = {
      Type: 'Parallel',
      End: true,
      Branches: [
        {
          StartAt: 'Add',
          States: {
            Add: {
              Type: 'Task',
              Resource: 'arn:aws:states:us-east-1:123456789012:activity:Add',
              End: true,
            },
          },
        },
        {
          StartAt: 'Subtract',
          States: {
            Subtract: {
              Type: 'Task',
              Resource: 'arn:aws:states:us-east-1:123456789012:activity:Subtract',
              End: true,
            },
          },
        },
      ],
    };
    const context = (<Context>{
      Resources: {
        invoke: (resource, payload: any) => {
          if (resource.endsWith(':Add')) {
            return payload[0] + payload[1];
          } else {
            return payload[0] - payload[1];
          }
        },
      },
    }) as unknown as Context;
    // When
    const result = await runState(context, state, [3, 2]);
    // Then
    expect(result).toStrictEqual([5, 1]);
    expect(context.Transition).toStrictEqual({ End: true });
  });
  it('runs a Map state (with Parameters)', async () => {
    // Given
    const state: State = {
      Type: 'Map',
      InputPath: '$.detail',
      ItemsPath: '$.shipped',
      MaxConcurrency: 1,
      ResultPath: '$.detail.shipped',
      Parameters: {
        'parcel.$': '$$.Map.Item.Value',
        'courier.$': "$['delivery-partner']",
      },
      Iterator: {
        StartAt: 'Validate',
        States: {
          Validate: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:ship-val',
            End: true,
          },
        },
      },
      End: true,
    };
    const context = (<Context>{
      Resources: {
        invoke: (resource, payload) => {
          return payload;
        },
      },
    }) as unknown as Context;
    const input = {
      'ship-date': '2016-03-14T01:59:00Z',
      detail: {
        'delivery-partner': 'UQS',
        shipped: [
          { prod: 'R31', 'dest-code': 9511, quantity: 1344 },
          { prod: 'S39', 'dest-code': 9511, quantity: 40 },
          { prod: 'R31', 'dest-code': 9833, quantity: 12 },
          { prod: 'R40', 'dest-code': 9860, quantity: 887 },
          { prod: 'R40', 'dest-code': 9511, quantity: 1220 },
        ],
      },
    };
    // When
    const result = await runState(context, state, input);
    // Then
    expect(result).toStrictEqual({
      detail: {
        'delivery-partner': 'UQS',
        shipped: [
          {
            courier: 'UQS',
            parcel: { 'dest-code': 9511, prod: 'R31', quantity: 1344 },
          },
          {
            courier: 'UQS',
            parcel: { 'dest-code': 9511, prod: 'S39', quantity: 40 },
          },
          {
            courier: 'UQS',
            parcel: { 'dest-code': 9833, prod: 'R31', quantity: 12 },
          },
          {
            courier: 'UQS',
            parcel: { 'dest-code': 9860, prod: 'R40', quantity: 887 },
          },
          {
            courier: 'UQS',
            parcel: { 'dest-code': 9511, prod: 'R40', quantity: 1220 },
          },
        ],
      },
      'ship-date': '2016-03-14T01:59:00Z',
    });
    expect(context.Transition).toStrictEqual({ End: true });
  });
  it('runs a Map state (without Parameters)', async () => {
    // Given
    const state: State = {
      Type: 'Map',
      InputPath: '$.detail',
      ItemsPath: '$.shipped',
      MaxConcurrency: 1,
      ResultPath: '$.detail.shipped',
      Iterator: {
        StartAt: 'Validate',
        States: {
          Validate: {
            Type: 'Task',
            Resource: 'arn:aws:lambda:us-east-1:123456789012:function:ship-val',
            End: true,
          },
        },
      },
      End: true,
    };
    const context = (<Context>{
      Resources: {
        invoke: (_resource, payload) => {
          if (typeof payload !== 'object') return payload;
          return { itWorks: true, ...payload };
        },
      },
    }) as unknown as Context;
    const input = {
      'ship-date': '2016-03-14T01:59:00Z',
      detail: {
        'delivery-partner': 'UQS',
        shipped: [
          { prod: 'R31', 'dest-code': 9511, quantity: 1344 },
          { prod: 'S39', 'dest-code': 9511, quantity: 40 },
          { prod: 'R31', 'dest-code': 9833, quantity: 12 },
          { prod: 'R40', 'dest-code': 9860, quantity: 887 },
          { prod: 'R40', 'dest-code': 9511, quantity: 1220 },
        ],
      },
    };
    // When
    const result = await runState(context, state, input);
    // Then
    expect(result).toStrictEqual({
      detail: {
        'delivery-partner': 'UQS',
        shipped: [
          {
            itWorks: true,
            'dest-code': 9511,
            prod: 'R31',
            quantity: 1344,
          },
          {
            itWorks: true,
            'dest-code': 9511,
            prod: 'S39',
            quantity: 40,
          },
          {
            itWorks: true,
            'dest-code': 9833,
            prod: 'R31',
            quantity: 12,
          },
          {
            itWorks: true,
            'dest-code': 9860,
            prod: 'R40',
            quantity: 887,
          },
          {
            itWorks: true,
            'dest-code': 9511,
            prod: 'R40',
            quantity: 1220,
          },
        ],
      },
      'ship-date': '2016-03-14T01:59:00Z',
    });
    expect(context.Transition).toStrictEqual({ End: true });
  });
  it('runs a Wait state (TimestampPath)', async () => {
    // Given
    const state: State = {
      Type: 'Wait',
      TimestampPath: '$.expirydate',
      Next: 'NextState',
    };
    const input = {
      expirydate: '2022-04-14T01:01:10.000Z',
    };
    const context = (<Context>{}) as unknown as Context;
    jest.useFakeTimers('modern');
    jest.setSystemTime(Date.parse('2022-04-14T01:01:00.000Z'));
    // When
    const promise = runState(context, state, input);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(9999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(0);
    await promise;
  });
  it('runs a Wait state (SecondsPath)', async () => {
    // Given
    const state: State = {
      Type: 'Wait',
      SecondsPath: '$.waitSeconds',
      Next: 'NextState',
    };
    const input = {
      waitSeconds: 10,
    };
    const context = (<Context>{}) as unknown as Context;
    jest.useFakeTimers('modern');
    jest.setSystemTime(Date.parse('2022-04-14T01:01:00.000Z'));
    // When
    const promise = runState(context, state, input);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(9999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(0);
    await promise;
  });
  it('runs a Wait state (Seconds)', async () => {
    // Given
    const state: State = {
      Type: 'Wait',
      Seconds: 10,
      Next: 'NextState',
    };
    const input = {};
    const context = (<Context>{}) as unknown as Context;
    jest.useFakeTimers('modern');
    jest.setSystemTime(Date.parse('2022-04-14T01:01:00.000Z'));
    // When
    const promise = runState(context, state, input);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(9999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(0);
    await promise;
  });
  it('runs a Wait state (Timestamp)', async () => {
    // Given
    const state: State = {
      Type: 'Wait',
      Timestamp: '2022-04-14T01:01:10.000Z',
      Next: 'NextState',
    };
    const input = {};
    const context = (<Context>{}) as unknown as Context;
    jest.useFakeTimers('modern');
    jest.setSystemTime(Date.parse('2022-04-14T01:01:00.000Z'));
    // When
    const promise = runState(context, state, input);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(9999);
    expect(jest.getTimerCount()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(jest.getTimerCount()).toBe(0);
    await promise;
  });
  it('runs a Succeed state', async () => {
    // Given
    const state: State = {
      Type: 'Succeed',
      InputPath: '$.a',
      OutputPath: '$.something',
    };
    const context = (<Context>{}) as unknown as Context;
    // When
    const result = await runState(context, state, { a: { something: [1, 2, 3, 4] }, b: 3 });
    // Then
    expect(result).toStrictEqual([1, 2, 3, 4]);
    expect(context.Transition).toStrictEqual({ End: true });
  });
  it('runs a Fail state', async () => {
    // Given
    const state: State = {
      Type: 'Fail',
      Error: 'SomeError',
      Cause: 'Some error message',
    };
    const context = (<Context>{}) as unknown as Context;
    // When
    let error: any;
    try {
      await runState(context, state, { a: { something: [1, 2, 3, 4] }, b: 3 });
    } catch (e) {
      error = e;
    }
    // Then
    expect(error?.name).toStrictEqual('SomeError');
    expect(error?.message).toStrictEqual('Some error message');
  });

  it('runs a Task state (Catch scenario)', async () => {
    // Given
    const state: State = {
      Type: 'Task',
      Resource: 'arn:aws:lambda:us-east-1:123456789012:function:Echo',
      ResultPath: '$.result',
      Catch: [
        { ErrorEquals: ['Error1'], Next: 'GoToError1' },
        { ErrorEquals: ['Error2'], Next: 'GoToError2' },
        { ErrorEquals: ['SomeError'], Next: 'HandleSomeError', ResultPath: '$.error' },
        { ErrorEquals: ['Error3'], Next: 'GoToError3' },
      ],
      End: true,
    };
    const context = (<Context>{
      Resources: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        invoke: async (_resource: string, _payload: unknown): Promise<unknown> => {
          throw new ExecutionError('SomeError', 'Some error msg');
        },
      },
    }) as unknown as Context;
    // When
    const result = await runState(context, state, { a: [1, 2, 3, 4] });
    // Then
    expect(result).toStrictEqual({
      a: [1, 2, 3, 4],
      error: {
        Error: 'SomeError',
        Cause: 'Some error msg',
      },
    });
    expect(context.Transition).toStrictEqual({ Next: 'HandleSomeError' });
  });
});

describe('run', () => {
  const awsErrorStateMachine: StateDefinition = {
    Comment: 'A Catch example of the Amazon States Language using an AWS Lambda function',
    StartAt: 'CreateAccount',
    States: {
      CreateAccount: {
        Type: 'Task',
        Resource: 'arn:aws:lambda:us-east-1:123456789012:function:FailFunction',
        Catch: [
          {
            ErrorEquals: ['CustomError'],
            Next: 'CustomErrorFallback',
          },
          {
            ErrorEquals: ['States.TaskFailed'],
            Next: 'ReservedTypeFallback',
          },
          {
            ErrorEquals: ['States.ALL'],
            Next: 'CatchAllFallback',
          },
        ],
        End: true,
      },
      CustomErrorFallback: {
        Type: 'Pass',
        Result: 'This is a fallback from a custom Lambda function exception',
        End: true,
      },
      ReservedTypeFallback: {
        Type: 'Pass',
        Result: 'This is a fallback from a reserved error code',
        End: true,
      },
      CatchAllFallback: {
        Type: 'Pass',
        Result: 'This is a fallback from any error code',
        End: true,
      },
    },
  };
  it('intercepts errors', async () => {
    // Given
    const options = {
      definition: awsErrorStateMachine,
      resourceContext: {
        invoke: (_resource: string, params: any) => {
          throw new ExecutionError(params.error.code, params.error.message);
        },
      },
    };
    // When
    const customError = await run(options, {
      error: { code: 'CustomError', message: 'Custom error' },
    });
    // Then
    expect(customError).toBe('This is a fallback from a custom Lambda function exception');

    // When
    const otherError = await run(options, {
      error: { code: 'OtherError', message: 'Some other error' },
    });
    // Then
    expect(otherError).toBe('This is a fallback from a reserved error code');
  });
});
