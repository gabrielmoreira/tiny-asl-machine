import type {
  BaseContext,
  Context,
  EndField,
  ExecutionContext,
  InputPathField,
  MapState,
  NextField,
  OutputPathField,
  ParametersField,
  ResourceContext,
  ResultPathField,
  ResultSelectorField,
  State,
  StateData,
  StateDefinition,
  StateExecutors,
  TaskState,
  WaitState,
} from '../../types';
import Debug from 'debug';
import pLimit from 'p-limit';
import { processChoices } from '../choices/operators';
import { clone } from '../utils/clone';
import { ExecutionError } from '../utils/executionError';
import { replacePathTemplateFields } from '../utils/replacePathTemplateFields';
import { selectPath } from '../utils/selectPath';
import { updatePath } from '../utils/updatePath';
const debug = Debug('tiny-asl-machine:state');

export async function run(
  {
    definition,
    resourceContext,
    executionContext,
  }: {
    definition: StateDefinition;
    resourceContext?: ResourceContext;
    executionContext?: ExecutionContext;
  },
  input: StateData
): Promise<StateData> {
  const baseContext = createBaseContext({ definition, resourceContext, executionContext }, input);
  return runUntilFinished(definition, baseContext, input, definition.StartAt);
}

async function runUntilFinished(
  definition: StateDefinition,
  context: Context | BaseContext,
  input: StateData,
  nextState: string
): Promise<StateData> {
  debug('===== Transitioning to state', nextState, '=====');
  const state = definition.States[nextState];
  if (!state) throw new ExecutionError('StateNotFound', `State '${nextState} not found`);
  const subContext = createContext(context, state, nextState);
  const output = await runState(subContext, state, input);
  if (subContext.Transition && 'Next' in subContext.Transition) {
    return runUntilFinished(definition, context, output, subContext.Transition.Next);
  }
  return output;
}

export async function runState(
  context: Context,
  state: State,
  input: StateData
): Promise<StateData> {
  // TODO implement retry logic
  return await catchErrors(context, state, input, () =>
    Executors[state.Type](context, state, input)
  );
}

const Executors: StateExecutors = {
  Pass: async (context, state, input) => {
    if (state.Type !== 'Pass')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Pass'");
    const output =
      typeof state.Result === 'undefined' ? processStateInput(context, state, input) : state.Result;
    const processedOutput = processStateOutput(context, state, input, output);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Task: async (context, state, input) => {
    if (state.Type !== 'Task')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Task'");
    const inputData = processStateInput(context, state, input);
    const output = await invokeTaskResource(context, state, inputData);
    const processedOutput = processStateOutput(context, state, input, output);
    if (!context.Transition) processNextOrEndState(context, state);
    return processedOutput;
  },
  Parallel: async (context, state, input) => {
    if (state.Type !== 'Parallel')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Parallel'");
    const inputData = processStateInput(context, state, input);
    const outputData = await Promise.all(
      state.Branches.map(definition =>
        runUntilFinished(definition, context, inputData, definition.StartAt)
      )
    );
    const processedOutput = processStateOutput(context, state, input, outputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Map: async (context, state, input) => {
    if (state.Type !== 'Map')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Map'");
    const inputData = processStateInput(context, state, input);
    const outputData = await processMapState(context, state, inputData);
    const processedOutput = processStateOutput(context, state, input, outputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Wait: async (context, state, input) => {
    if (state.Type !== 'Wait')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Wait'");
    const inputData = processStateInput(context, state, input);
    const delay = calculateWaitDelayInMs(context, state, inputData);
    debug('Delay of', delay, 'will be', Date.now() + delay);
    await new Promise(resolve => setTimeout(() => resolve(void 0), delay));
    debug('After delay');
    const processedOutput = processStateOutput(context, state, input, inputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Choice: async (context, state, input) => {
    if (state.Type !== 'Choice')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Choice'");
    const inputData = processStateInput(context, state, input);
    const selectedState = processChoices(context, state.Choices, inputData) || state.Default;
    if (!selectedState)
      throw new ExecutionError(
        'States.NoChoiceMatched',
        `Choice State (${
          context.State?.Name ?? 'unnamed'
        }) failed to match a Choice Rule and no "Default" transition was specified`
      );
    context.Transition = { Next: selectedState };
    return input;
  },
  Succeed: async (context, state, input) => {
    if (state.Type !== 'Succeed')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Succeed'");
    const inputData = processStateInput(context, state, input);
    const processedOutput = processStateOutput(context, state, input, inputData);
    context.Transition = { End: true };
    return processedOutput;
  },
  Fail: async (_context, state) => {
    if (state.Type !== 'Fail')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Fail'");
    throw new ExecutionError(
      state.Error || 'StateFailed',
      state.Cause || 'Terminated in a failed state'
    );
  },
};

async function catchErrors(
  context: Context,
  state: State,
  input: StateData,
  fn: () => Promise<StateData>
) {
  context.Transition = undefined;
  context.ExecutionError = undefined;
  try {
    return await fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if ('Catch' in state && state.Catch) {
      const catcher = state.Catch.find(p => {
        if (
          p.ErrorEquals.includes(e.name) ||
          p.ErrorEquals.includes('States.ALL') ||
          // https://docs.aws.amazon.com/step-functions/latest/dg/bp-lambda-serviceexception.html
          // https://docs.aws.amazon.com/step-functions/latest/dg/tutorial-handling-error-conditions.html
          // https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html#API_Invoke_Errors
          // TODO this is not correct...
          (state.Type === 'Task' && p.ErrorEquals.includes('States.TaskFailed')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('Lambda.Unknown')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('States.DataLimitExceeded')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('Lambda.TooManyRequestsException')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('Lambda.ServiceException')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('Lambda.AWSLambdaException')) ||
          (state.Type === 'Task' && p.ErrorEquals.includes('Lambda.SdkClientException')) ||
          (state.Type === 'Parallel' && p.ErrorEquals.includes('States.BranchFailed'))
        )
          return true;
      });
      // console.log('Catcher', catcher);
      if (catcher) {
        context.ExecutionError = { Error: e.name, Cause: e.message };
        context.Transition = { Next: catcher.Next };
        if (catcher.ResultPath) {
          return applyResultPath(catcher.ResultPath, input, context.ExecutionError);
        }
        return context.ExecutionError;
      }
    }
    throw e;
  }
}

async function invokeTaskResource(context: Context, state: TaskState, payload: unknown) {
  return await context.Resources?.invoke(state.Resource, payload);
}
async function processMapState(context: Context, state: MapState, input: StateData) {
  let items = input;
  debug('[processMapState] input', input);
  if ('ItemsPath' in state && typeof state.ItemsPath !== 'undefined') {
    items = selectPath(state.ItemsPath, input, context);
    debug('[processMapState] items after ItemsPath', items);
  }
  if (!Array.isArray(items))
    throw new ExecutionError('InvalidMapInput', 'Map state input must be an array.');

  const limit = pLimit(state.MaxConcurrency || Infinity);
  return await Promise.all(
    items.map((inputItem, index) =>
      limit(() => {
        const mapContext = createMapContext(context, index, inputItem);
        const mapInput = hasParameters(state)
          ? buildParameters(state, input, mapContext)
          : inputItem;
        debug('[processMapState] after buildParameters', mapInput);
        return runUntilFinished(state.Iterator, mapContext, mapInput, state.Iterator.StartAt);
      })
    )
  );
}

function processStateInput(context: Context, state: State, input: StateData) {
  let data = input;
  debug('[processStateInput] state raw input', data);
  data = selectInputPath(state, data, context);
  debug('[processStateInput] after selectInputPath', data);
  if (state.Type !== 'Map') {
    data = buildParameters(state, data, context);
    debug('[processStateInput] after buildParameters', data);
  }
  return data;
}

function processStateOutput(context: Context, state: State, input: StateData, output: StateData) {
  let data = output;
  debug('[processStateOutput] state raw output', data);
  data = buildResultSelector(state, data, context);
  debug('[processStateOutput] after buildResultSelector', data);
  data = buildResultPath(state, input, data);
  debug('[processStateOutput] after buildResultPath', data);
  data = buildOutputPath(state, data, context);
  debug('[processStateOutput] after buildOutputPath', data);
  return data;
}

function selectInputPath(state: State, input: StateData, context: Context): StateData {
  if (hasInputPath(state)) {
    return selectPath(state.InputPath, input, context); // TODO check if we should use .value (single) or .query (multiple)
  }
  return input;
}

function hasInputPath(state: State): state is State & Required<InputPathField> {
  return 'InputPath' in state && typeof state.InputPath === 'string';
}

function buildParameters(state: State, input: StateData, context: Context) {
  if (hasParameters(state)) return replacePathTemplateFields(state.Parameters, input, context);
  return input;
}

function hasParameters(state: State): state is State & Required<ParametersField> {
  return 'Parameters' in state && typeof state.Parameters === 'object';
}

function buildResultSelector(state: State, data: StateData, context: Context) {
  if (hasResultSelector(state))
    return replacePathTemplateFields(state.ResultSelector, data, context);
  return data;
}

function hasResultSelector(state: State): state is State & Required<ResultSelectorField> {
  return 'ResultSelector' in state && typeof state.ResultSelector === 'object';
}

function buildResultPath(state: State, input: StateData, output: StateData) {
  if (hasResultPath(state)) {
    return applyResultPath(state.ResultPath, input, output);
  }
  return output;
}

function applyResultPath(resultPath: string | null, input: StateData, output: StateData) {
  if (resultPath === null) return input;
  if (resultPath === '$') return output;
  if (typeof resultPath === 'string') {
    const inputData = clone(input);
    updatePath(inputData, resultPath, output);
    // TODO Implement States.ResultPathMatchFailure - https://states-language.net/#errors
    return inputData;
  }
}

function hasResultPath(state: State): state is State & Required<ResultPathField> {
  return 'ResultPath' in state && typeof state.ResultPath !== 'undefined';
}

function buildOutputPath(state: State, output: StateData, context: Context) {
  if (hasOutputPath(state)) {
    if (state.OutputPath === '$') return output;
    return selectPath(state.OutputPath, output, context);
  }
  return output;
}

function hasOutputPath(state: State): state is State & Required<OutputPathField> {
  return 'OutputPath' in state && typeof state.OutputPath !== 'undefined';
}

function processNextOrEndState(context: Context, state: State) {
  if (hasEndField(state)) {
    context.Transition = { End: state.End };
  } else if (hasNextField(state)) {
    context.Transition = { Next: state.Next };
  }
}

function hasNextField(state: State): state is State & Required<NextField> {
  return 'Next' in state && typeof state.Next !== 'undefined';
}

function hasEndField(state: State): state is State & Required<EndField> {
  return 'End' in state && state.End === true;
}

function calculateWaitDelayInMs(context: Context, state: WaitState, input: StateData): number {
  if ('Seconds' in state) {
    return state.Seconds * 1000;
  } else if ('SecondsPath' in state) {
    return (selectPath(state.SecondsPath, input, context) as number) * 1000;
  } else if ('Timestamp' in state) {
    const date = Date.parse(state.Timestamp);
    return Math.max(date - Date.now(), 0);
  } else if ('TimestampPath' in state) {
    const timestamp = selectPath(state.TimestampPath, input, context) as string;
    const date = Date.parse(timestamp);
    return Math.max(date - Date.now(), 0);
  } else {
    return 0;
  }
}

export function createBaseContext(
  {
    resourceContext,
    executionContext,
  }: {
    definition: StateDefinition;
    resourceContext?: ResourceContext;
    executionContext?: ExecutionContext;
  },
  initialInput: StateData
) {
  const baseContext: BaseContext = {
    Resources: resourceContext,
    StateMachine: {
      Id: `machine-${Date.now()}`,
      Name: `machine`,
    },
    Execution: {
      StartTime: new Date().toISOString(),
      Id: `execution-${Date.now()}`,
      Name: 'execution',
      RoleArn: 'machine-role',
      Input: initialInput,
      ...(executionContext || {}),
    },
  };
  return baseContext;
}

export function createMapContext(context: Context, itemIndex: number, itemValue: unknown): Context {
  return {
    ...context,
    Map: {
      Item: {
        Index: itemIndex,
        Value: itemValue,
      },
    },
  };
}

export function createContext(baseContext: BaseContext, state: State, stateName: string): Context {
  const enteredTime = new Date().toISOString();
  const taskContext =
    state.Type === 'Task'
      ? {
          Token: `TaskToken-${Date.now()}`,
        }
      : undefined;
  return {
    ...baseContext,
    State: {
      Name: stateName,
      EnteredTime: enteredTime,
      RetryCount: 0,
    },
    ...(taskContext ? { Task: taskContext } : {}),
  };
}
