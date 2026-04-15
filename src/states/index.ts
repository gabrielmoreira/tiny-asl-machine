import type {
  BaseContext,
  Catcher,
  Context,
  EndField,
  ExecutionContext,
  InputPathField,
  JsonataChoiceRule,
  MapState,
  NextField,
  OutputPathField,
  ParametersField,
  ResourceContext,
  ResultPathField,
  ResultSelectorField,
  RuntimeAdapter,
  State,
  StateData,
  StateDefinition,
  StateExecutors,
  TaskState,
  TopLevelChoiceRule,
  WaitState,
} from '../../types';
import Debug from 'debug';
import { processChoices } from '../choices/operators';
import { clone } from '../utils/clone';
import { ExecutionError } from '../utils/executionError';
import { evaluateJsonataTemplateFields } from '../utils/evaluateJsonataTemplateFields';
import { isJsonataString, tryExtractJsonataExpression } from '../utils/jsonataTemplate';
import { replacePathTemplateFields } from '../utils/replacePathTemplateFields';
import { createDefaultRuntime } from '../utils/runtime';
import { selectPath } from '../utils/selectPath';
import { updatePath } from '../utils/updatePath';
const debug = Debug('tiny-asl-machine:state');

function getRuntime(context: Context | BaseContext) {
  return context.Runtime ?? createDefaultRuntime();
}

export async function run(
  {
    definition,
    resourceContext,
    executionContext,
    runtime,
  }: {
    definition: StateDefinition;
    resourceContext?: ResourceContext;
    executionContext?: ExecutionContext;
    runtime?: RuntimeAdapter;
  },
  input: StateData
): Promise<StateData> {
  validateDefinition(definition);
  const baseContext = createBaseContext(
    { definition, resourceContext, executionContext, runtime },
    input
  );
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

function validateDefinition(
  definition: StateDefinition,
  parentScopeNames: ReadonlySet<string> = new Set()
): void {
  validateStructuralDefinition(definition);
  const currentScopeNames = collectAssignedNames(definition);

  for (const name of currentScopeNames) {
    if (parentScopeNames.has(name)) {
      const error = new Error(`The variable name '${name}' was already defined in a parent scope.`);
      error.name = 'VALIDATION_FAILED';
      throw error;
    }
  }

  const visibleNames = new Set([...parentScopeNames, ...currentScopeNames]);

  for (const state of Object.values(definition.States)) {
    validateState(state, visibleNames);
  }
}

function validateState(state: State, visibleNames: ReadonlySet<string>): void {
  if (state.Type === 'Pass') {
    validateNoReservedStatesAccess('Output' in state ? state.Output : undefined, [
      '$states.result',
      '$states.errorOutput',
    ]);
    validateNoReservedStatesAccess(state.Assign, ['$states.result', '$states.errorOutput']);
  }

  if (state.Type === 'Task') {
    validateNoReservedStatesAccess('Arguments' in state ? state.Arguments : undefined, [
      '$states.result',
      '$states.errorOutput',
    ]);
  }

  if (state.Type === 'Parallel') {
    for (const definition of state.Branches) {
      validateDefinition(definition, visibleNames);
    }
  }

  if (state.Type === 'Map') {
    validateMapItemReader(state);
    const iteratorDefinition =
      'Iterator' in state && state.Iterator
        ? state.Iterator
        : 'ItemProcessor' in state && state.ItemProcessor
          ? state.ItemProcessor
          : undefined;
    if (iteratorDefinition) {
      validateDefinition(iteratorDefinition, visibleNames);
    }
  }
}

function validateMapItemReader(state: MapState): void {
  if (!('ItemReader' in state) || !state.ItemReader) return;
  // Intentionally left as a no-op for now. Advanced ItemReader validation is pinned via
  // AWS-backed conformance cases and local ItemReader validation remains incomplete.
}

function validateStatesAllPlacement(entries: Array<{ ErrorEquals?: string[] }> | undefined): void {
  if (!entries) return;

  for (const [index, entry] of entries.entries()) {
    if (!entry.ErrorEquals?.includes('States.ALL')) continue;
    if (entry.ErrorEquals.length !== 1 || index !== entries.length - 1) {
      const error = new Error('States.ALL must appear alone and at end of list');
      error.name = 'VALIDATION_FAILED';
      throw error;
    }
  }
}

function collectReachableStates(definition: StateDefinition, startAt: string): Set<string> {
  const reachable = new Set<string>();
  const stack = [startAt];

  while (stack.length > 0) {
    const stateName = stack.pop();
    if (!stateName || reachable.has(stateName)) continue;
    reachable.add(stateName);

    const state = definition.States[stateName];
    if (!state) continue;

    if ('Next' in state && state.Next) stack.push(state.Next);
    if ('Catch' in state && state.Catch) {
      for (const catcher of state.Catch) {
        if (catcher.Next) stack.push(catcher.Next);
      }
    }
    if (state.Type === 'Choice') {
      for (const choice of state.Choices) {
        if ('Next' in choice && choice.Next) stack.push(choice.Next);
      }
      if (state.Default) stack.push(state.Default);
    }
  }

  return reachable;
}

function validateStructuralDefinition(definition: StateDefinition): void {
  const stateNames = new Set(Object.keys(definition.States));
  const transitionTargets = new Set<string>();

  for (const state of Object.values(definition.States)) {
    if ('Next' in state && state.Next) transitionTargets.add(state.Next);
    if ('Retry' in state && state.Retry) validateStatesAllPlacement(state.Retry);
    if ('Catch' in state && state.Catch) {
      validateStatesAllPlacement(state.Catch);
      for (const catcher of state.Catch) {
        if (catcher.Next) transitionTargets.add(catcher.Next);
      }
    }
    if (state.Type === 'Choice') {
      for (const choice of state.Choices) {
        if ('Next' in choice && choice.Next) transitionTargets.add(choice.Next);
      }
      if (state.Default) transitionTargets.add(state.Default);
    }
  }

  for (const target of transitionTargets) {
    if (!stateNames.has(target)) {
      const error = new Error(`Missing 'Next' target: ${target}`);
      error.name = 'VALIDATION_FAILED';
      throw error;
    }
  }

  const reachable = collectReachableStates(definition, definition.StartAt);
  for (const stateName of stateNames) {
    if (!reachable.has(stateName)) {
      const error = new Error(`State "${stateName}" is not reachable.`);
      error.name = 'VALIDATION_FAILED';
      throw error;
    }
  }

  const hasTerminalState = [...reachable].some(stateName => {
    const state = definition.States[stateName];
    return (
      state.Type === 'Succeed' || state.Type === 'Fail' || ('End' in state && state.End === true)
    );
  });

  if (!hasTerminalState) {
    const error = new Error('Workflow has no terminal state');
    error.name = 'VALIDATION_FAILED';
    throw error;
  }
}

function collectAssignedNames(definition: StateDefinition): Set<string> {
  const names = new Set<string>();

  for (const state of Object.values(definition.States)) {
    if ('Assign' in state && state.Assign) {
      for (const name of Object.keys(state.Assign)) names.add(name);
    }
    if (state.Type === 'Choice') {
      for (const rule of state.Choices) {
        if ('Assign' in rule && rule.Assign) {
          for (const name of Object.keys(rule.Assign)) names.add(name);
        }
      }
    }
    if ('Catch' in state && state.Catch) {
      for (const catcher of state.Catch) {
        if ('Assign' in catcher && catcher.Assign) {
          for (const name of Object.keys(catcher.Assign)) names.add(name);
        }
      }
    }
  }

  return names;
}

function validateNoReservedStatesAccess(value: unknown, forbiddenRefs: string[]): void {
  if (typeof value === 'undefined') return;

  if (Array.isArray(value)) {
    for (const item of value) validateNoReservedStatesAccess(item, forbiddenRefs);
    return;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      validateNoReservedStatesAccess(nested, forbiddenRefs);
    }
    return;
  }

  if (!isJsonataString(value)) return;
  const expression = tryExtractJsonataExpression(value);
  if (typeof expression === 'undefined') return;

  for (const forbiddenRef of forbiddenRefs) {
    if (expression.includes(forbiddenRef)) {
      const error = new Error(
        `Field references unsupported reserved variable access: ${forbiddenRef}`
      );
      error.name = 'VALIDATION_FAILED';
      throw error;
    }
  }
}

export async function runState(
  context: Context,
  state: State,
  input: StateData
): Promise<StateData> {
  const existingState = context.State;
  context.State ??= {
    Name: existingState?.Name ?? state.Type,
    EnteredTime: existingState?.EnteredTime ?? getRuntime(context).now(),
    RetryCount: 0,
  };
  context.VariableScopes ??= [{}];
  context.StateEntryVariables = getVisibleVariableBindings(context);
  context.State.RetryCount = 0;
  let totalRetryCount = 0;
  const retrierRetryCounts = new Map<object, number>();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    context.Transition = undefined;
    context.ExecutionError = undefined;

    try {
      const output = await Executors[state.Type](context, state, input);
      await applyStateAssignIfPresent(context, state, input, output);
      return output;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const retrier = findMatchingRetrier(state, error);
      const retrierRetryCount = retrier ? (retrierRetryCounts.get(retrier) ?? 0) : 0;
      if (retrier && retrierRetryCount < getRetrierMaxAttempts(retrier)) {
        const delay = calculateRetryDelayMs(context, retrier, retrierRetryCount);
        retrierRetryCounts.set(retrier, retrierRetryCount + 1);
        totalRetryCount += 1;
        context.State.RetryCount = totalRetryCount;
        debug(
          '[runState] retrying state',
          context.State.Name,
          'retrierRetryCount',
          retrierRetryCount + 1,
          'totalRetryCount',
          totalRetryCount,
          'delay',
          delay
        );
        await getRuntime(context).sleep(delay);
        continue;
      }

      return await handleStateFailure(context, state, input, error);
    }
  }
}

const Executors: StateExecutors = {
  Pass: async (context, state, input) => {
    if (state.Type !== 'Pass')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Pass'");
    const output =
      'Result' in state && typeof state.Result !== 'undefined'
        ? state.Result
        : await processStateInput(context, state, input);
    const processedOutput = await processStateOutput(context, state, input, output);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Task: async (context, state, input) => {
    if (state.Type !== 'Task')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Task'");
    await validateTaskTimeoutSeconds(context, state, input);
    const inputData = await processStateInput(context, state, input);
    const output = await invokeTaskResource(context, state, inputData);
    const processedOutput = await processStateOutput(context, state, input, output);
    if (!context.Transition) processNextOrEndState(context, state);

    async function validateTaskTimeoutSeconds(
      context: Context,
      state: Extract<State, { Type: 'Task' }>,
      input: StateData
    ): Promise<void> {
      if (!('TimeoutSeconds' in state) || typeof state.TimeoutSeconds === 'undefined') {
        return;
      }

      const expression =
        typeof state.TimeoutSeconds === 'string'
          ? (tryExtractJsonataExpression(state.TimeoutSeconds) ?? state.TimeoutSeconds)
          : String(state.TimeoutSeconds);

      const timeoutValue =
        getQueryLanguage(context, state) === 'JSONata' && typeof state.TimeoutSeconds === 'string'
          ? await evaluateJsonataTemplateFields(state.TimeoutSeconds, { input, context })
          : state.TimeoutSeconds;

      if (typeof timeoutValue === 'undefined') {
        throw new ExecutionError(
          'States.QueryEvaluationError',
          `The JSONata expression '${expression}' specified for the field 'TimeoutSeconds' returned nothing (undefined).`
        );
      }

      if (typeof timeoutValue !== 'number') {
        throw new ExecutionError(
          'States.QueryEvaluationError',
          `The JSONata expression '${expression}' specified for the field 'TimeoutSeconds' returned an unexpected result type. Expected 'number', but was '${typeof timeoutValue}' for value: ${JSON.stringify(timeoutValue)}`
        );
      }

      if (!Number.isInteger(timeoutValue)) {
        throw new ExecutionError(
          'States.QueryEvaluationError',
          `The TimeoutSeconds field cannot be parsed as an integer: ${timeoutValue}`
        );
      }

      if (timeoutValue < 0 || timeoutValue > 99999999) {
        throw new ExecutionError(
          'States.QueryEvaluationError',
          `TimeoutSeconds must be between 0 and 99999999 but was: ${timeoutValue}`
        );
      }
    }
    return processedOutput;
  },
  Parallel: async (context, state, input) => {
    if (state.Type !== 'Parallel')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Parallel'");
    const inputData = await processStateInput(context, state, input);
    const outputData = await Promise.all(
      state.Branches.map(definition =>
        runUntilFinished(
          definition,
          createChildScopeContext(context),
          inputData,
          definition.StartAt
        )
      )
    );
    const processedOutput = await processStateOutput(context, state, input, outputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Map: async (context, state, input) => {
    if (state.Type !== 'Map')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Map'");
    const inputData = await processStateInput(context, state, input);
    const outputData = await processMapState(context, state, inputData);
    const processedOutput = await processStateOutput(context, state, input, outputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Wait: async (context, state, input) => {
    if (state.Type !== 'Wait')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Wait'");
    const inputData = await processStateInput(context, state, input);
    const delay = await calculateWaitDelayInMs(context, state, inputData);
    debug('Delay of', delay, 'ms');
    await getRuntime(context).sleep(delay);
    debug('After delay');
    const processedOutput = await processStateOutput(context, state, input, inputData);
    processNextOrEndState(context, state);
    return processedOutput;
  },
  Choice: async (context, state, input) => {
    if (state.Type !== 'Choice')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Choice'");
    const inputData = await processStateInput(context, state, input);

    if (getQueryLanguage(context, state) === 'JSONata') {
      const matchedRule = await findMatchingJsonataChoiceRule(context, state, inputData);
      const selectedState = matchedRule?.Next ?? state.Default;
      if (!selectedState) {
        throw new ExecutionError('States.NoChoiceMatched', 'Choice state did not match any rule.');
      }
      const choiceOutput = await buildJsonataChoiceOutput(context, state, inputData, matchedRule);
      await applyChoiceRuleAssignIfPresent(context, matchedRule, inputData);
      context.Transition = { Next: selectedState };
      return choiceOutput;
    }

    const selectedState =
      processChoices(context, getJsonPathChoiceRules(state), inputData) || state.Default;
    if (!selectedState)
      throw new ExecutionError(
        'States.Runtime',
        'Failed to transition out of the state. The state does not point to a next state.'
      );
    context.Transition = { Next: selectedState };
    return input;
  },
  Succeed: async (context, state, input) => {
    if (state.Type !== 'Succeed')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Succeed'");
    const inputData = await processStateInput(context, state, input);
    const processedOutput = await processStateOutput(context, state, input, inputData);
    context.Transition = { End: true };
    return processedOutput;
  },
  Fail: async (context, state, input) => {
    if (state.Type !== 'Fail')
      throw new ExecutionError('InvalidStateType', "State Type should be 'Fail'");

    const errorTemplate = 'Error' in state ? state.Error : undefined;
    const errorPath = 'ErrorPath' in state ? state.ErrorPath : undefined;
    const causeTemplate = 'Cause' in state ? state.Cause : undefined;
    const causePath = 'CausePath' in state ? state.CausePath : undefined;
    const defaultErrorName =
      typeof causeTemplate === 'string' || typeof causePath === 'string' ? 'FAILED' : 'StateFailed';
    const errorName =
      getQueryLanguage(context, state) === 'JSONata'
        ? typeof errorTemplate === 'undefined'
          ? defaultErrorName
          : String(await replacePathTemplateFields(errorTemplate, input, context))
        : typeof errorTemplate === 'string'
          ? errorTemplate
          : typeof errorPath === 'string'
            ? getStringPathValue(selectPath(errorPath, input, context), errorPath)
            : defaultErrorName;
    const cause =
      getQueryLanguage(context, state) === 'JSONata'
        ? typeof causeTemplate === 'undefined'
          ? 'FAILED'
          : String(await replacePathTemplateFields(causeTemplate, input, context))
        : typeof causeTemplate === 'string'
          ? causeTemplate
          : typeof causePath === 'string'
            ? getStringPathValue(selectPath(causePath, input, context), causePath)
            : 'FAILED';

    throw new ExecutionError(errorName, cause);
  },
};

function findMatchingRetrier(state: State, error: Error) {
  if (!('Retry' in state) || !state.Retry) {
    return undefined;
  }

  return state.Retry.find(retrier =>
    retrier.ErrorEquals.some(errorName => matchesErrorName(state, error, errorName))
  );
}

function getRetrierMaxAttempts(retrier: { MaxAttempts?: number }) {
  return retrier.MaxAttempts ?? 3;
}

function calculateRetryDelayMs(
  context: Context,
  retrier: {
    IntervalSeconds?: number;
    BackoffRate?: number;
    MaxDelaySeconds?: number;
    JitterStrategy?: string;
  },
  retryCount: number
) {
  const intervalSeconds = retrier.IntervalSeconds ?? 1;
  const backoffRate = retrier.BackoffRate ?? 2;
  const calculatedDelayMs = intervalSeconds * 1000 * Math.pow(backoffRate, retryCount);
  const maxDelayMs =
    typeof retrier.MaxDelaySeconds === 'number' ? retrier.MaxDelaySeconds * 1000 : undefined;
  const cappedDelayMs =
    typeof maxDelayMs === 'number' ? Math.min(calculatedDelayMs, maxDelayMs) : calculatedDelayMs;

  if (retrier.JitterStrategy === 'FULL') {
    return getRuntime(context).random(0, cappedDelayMs + 1);
  }

  return cappedDelayMs;
}

async function handleStateFailure(
  context: Context,
  state: State,
  input: StateData,
  error: Error
): Promise<StateData> {
  if ('Catch' in state && state.Catch) {
    const catcher = state.Catch.find(entry =>
      entry.ErrorEquals.some(errorName => matchesErrorName(state, error, errorName))
    );
    if (catcher) {
      context.ExecutionError = { Error: error.name, Cause: error.message };
      context.Transition = { Next: catcher.Next };
      await applyAssignRecord(
        context,
        getCatcherAssign(catcher),
        input,
        undefined,
        context.ExecutionError
      );
      if (
        getQueryLanguage(context, state) === 'JSONata' &&
        'Output' in catcher &&
        typeof catcher.Output !== 'undefined'
      ) {
        return await replacePathTemplateFields(
          catcher.Output,
          input,
          context,
          undefined,
          context.ExecutionError,
          context.StateEntryVariables
        );
      }
      if ('ResultPath' in catcher && typeof catcher.ResultPath !== 'undefined') {
        return applyResultPath(catcher.ResultPath, input, context.ExecutionError);
      }
      return context.ExecutionError;
    }
  }

  throw error;
}

function matchesErrorName(state: State, error: Error, errorName: string) {
  return (
    errorName === error.name ||
    errorName === 'States.ALL' ||
    (state.Type === 'Task' && errorName === 'States.TaskFailed') ||
    (state.Type === 'Task' && errorName === 'Lambda.Unknown') ||
    (state.Type === 'Task' && errorName === 'States.DataLimitExceeded') ||
    (state.Type === 'Task' && errorName === 'Lambda.TooManyRequestsException') ||
    (state.Type === 'Task' && errorName === 'Lambda.ServiceException') ||
    (state.Type === 'Task' && errorName === 'Lambda.AWSLambdaException') ||
    (state.Type === 'Task' && errorName === 'Lambda.SdkClientException') ||
    (state.Type === 'Parallel' && errorName === 'States.BranchFailed')
  );
}

function getQueryLanguage(context: Context | BaseContext, state: State) {
  return (
    ('QueryLanguage' in state && state.QueryLanguage) ||
    context.StateMachine?.QueryLanguage ||
    'JSONPath'
  );
}

async function findMatchingJsonataChoiceRule(
  context: Context,
  state: Extract<State, { Type: 'Choice' }>,
  input: StateData
) {
  for (const rule of state.Choices) {
    if (!('Condition' in rule)) {
      continue;
    }

    const conditionValue =
      typeof rule.Condition === 'boolean'
        ? rule.Condition
        : await replacePathTemplateFields(rule.Condition, input, context);

    if (typeof conditionValue !== 'boolean') {
      throw new ExecutionError(
        'States.QueryEvaluationError',
        `JSONata Choice condition must evaluate to a boolean: ${JSON.stringify(rule.Condition)}`
      );
    }

    if (conditionValue) {
      return rule;
    }
  }

  return undefined;
}

async function buildJsonataChoiceOutput(
  context: Context,
  state: Extract<State, { Type: 'Choice' }>,
  input: StateData,
  matchedRule?: { Output?: string | Record<string, unknown> }
) {
  if (matchedRule && 'Output' in matchedRule && typeof matchedRule.Output !== 'undefined') {
    return await replacePathTemplateFields(matchedRule.Output, input, context);
  }

  if ('Output' in state && typeof state.Output !== 'undefined') {
    return await replacePathTemplateFields(state.Output, input, context);
  }

  return input;
}

async function applyChoiceRuleAssignIfPresent(
  context: Context,
  matchedRule: { Assign?: Record<string, unknown> } | undefined,
  input: StateData
) {
  await applyAssignRecord(context, matchedRule?.Assign, input);
}

async function applyStateAssignIfPresent(
  context: Context,
  state: State,
  input: StateData,
  output: StateData
) {
  if (!('Assign' in state) || typeof state.Assign === 'undefined') {
    return;
  }

  await applyAssignRecord(context, state.Assign, input, output);
}

async function applyAssignRecord(
  context: Context,
  assign: Record<string, unknown> | undefined,
  input: StateData,
  output?: StateData,
  errorOutput?: unknown
) {
  if (typeof assign === 'undefined') {
    return;
  }

  if ('states' in assign) {
    throw new ExecutionError(
      'States.QueryEvaluationError',
      'Assign must not write the reserved variable states.'
    );
  }

  const assigned = await replacePathTemplateFields(
    assign,
    input,
    context,
    output,
    errorOutput,
    context.StateEntryVariables
  );

  if (!isRecord(assigned)) {
    throw new ExecutionError('States.QueryEvaluationError', 'Assign must evaluate to an object.');
  }

  Object.assign(getCurrentVariableScope(context), assigned);
}

function getVisibleVariableBindings(context: Context) {
  return Object.assign({}, ...(context.VariableScopes ?? []));
}

function getCurrentVariableScope(context: Context) {
  context.VariableScopes ??= [{}];
  return context.VariableScopes[context.VariableScopes.length - 1];
}

function createChildScopeContext(context: Context) {
  return {
    ...context,
    VariableScopes: [...(context.VariableScopes ?? []), {}],
  };
}

function getJsonPathChoiceRules(state: Extract<State, { Type: 'Choice' }>): TopLevelChoiceRule[] {
  return state.Choices.filter(isTopLevelChoiceRule);
}

function isTopLevelChoiceRule(
  rule: TopLevelChoiceRule | JsonataChoiceRule
): rule is TopLevelChoiceRule {
  return !('Condition' in rule);
}

function getCatcherAssign(catcher: Catcher): Record<string, unknown> | undefined {
  return isRecord(catcher.Assign) ? catcher.Assign : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNumericPathValue(value: unknown, path: string): number {
  if (typeof value !== 'number') {
    throw new ExecutionError('States.Runtime', `Expected numeric value at path '${path}'.`);
  }

  return value;
}

function getStringPathValue(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new ExecutionError('States.Runtime', `Expected string value at path '${path}'.`);
  }

  return value;
}

type PLimitFactory = (concurrency: number) => <T>(fn: () => Promise<T>) => Promise<T>;

let pLimitFactoryPromise: Promise<PLimitFactory> | undefined;

async function getPLimitFactory() {
  pLimitFactoryPromise ??= import('p-limit').then(module => {
    if (!isPLimitFactory(module.default)) {
      throw new Error('p-limit default export is not a function');
    }

    return module.default;
  });
  return await pLimitFactoryPromise;
}

function isPLimitFactory(value: unknown): value is PLimitFactory {
  return typeof value === 'function';
}

async function invokeTaskResource(context: Context, state: TaskState, payload: unknown) {
  return await context.Resources?.invoke(state.Resource, payload);
}
async function processMapState(context: Context, state: MapState, input: StateData) {
  let items: StateData = input;
  let itemSource: string | undefined;
  let itemSources: Array<string | undefined> | undefined;
  debug('[processMapState] input', input);

  if ('ItemReader' in state && state.ItemReader) {
    const readResult = await processItemReader(context, state, input);
    items = readResult.items;
    itemSource = readResult.source;
    itemSources = readResult.itemSources;
    debug('[processMapState] items after ItemReader', items);
  } else if (
    getQueryLanguage(context, state) === 'JSONata' &&
    'Items' in state &&
    (state as { Items?: unknown }).Items !== undefined
  ) {
    items = (await evaluateJsonataTemplateFields((state as { Items: unknown }).Items, {
      input,
      context,
    })) as StateData;
    debug('[processMapState] items after Items (JSONata)', items);
  } else if ('ItemsPath' in state && typeof state.ItemsPath !== 'undefined') {
    items = selectPath(state.ItemsPath, input, context);
    debug('[processMapState] items after ItemsPath', items);
  }
  if (!Array.isArray(items))
    throw new ExecutionError('InvalidMapInput', 'Map state input must be an array.');

  const maxConcurrency = getMapMaxConcurrency(context, state, input);
  const pLimit = await getPLimitFactory();
  const limit = pLimit(maxConcurrency || Infinity);
  return await Promise.all(
    items.map((inputItem, index) =>
      limit(async () => {
        const mapContext = createMapContext(
          context,
          index,
          inputItem,
          itemSources?.[index] ?? itemSource
        );
        const mapInput = hasItemSelector(state)
          ? await buildItemSelector(state, input, mapContext)
          : hasParameters(state)
            ? await buildParameters(state, input, mapContext)
            : inputItem;
        debug('[processMapState] after buildParameters', mapInput);
        const iteratorDefinition = getMapIteratorDefinition(state);
        return runUntilFinished(
          iteratorDefinition,
          mapContext,
          mapInput,
          iteratorDefinition.StartAt
        );
      })
    )
  );
}

function getMapMaxConcurrency(context: Context, state: MapState, input: StateData) {
  if ('MaxConcurrency' in state && typeof state.MaxConcurrency === 'number') {
    return state.MaxConcurrency;
  }

  if ('MaxConcurrencyPath' in state && typeof state.MaxConcurrencyPath === 'string') {
    return getNumericPathValue(
      selectPath(state.MaxConcurrencyPath, input, context),
      state.MaxConcurrencyPath
    );
  }

  return undefined;
}

function getMapIteratorDefinition(state: MapState): StateDefinition {
  if ('Iterator' in state && state.Iterator) {
    return state.Iterator;
  }

  if ('ItemProcessor' in state && state.ItemProcessor) {
    return state.ItemProcessor;
  }

  throw new ExecutionError('States.Runtime', 'Map state requires Iterator or ItemProcessor.');
}

async function processStateInput(context: Context, state: State, input: StateData) {
  let data = input;
  debug('[processStateInput] state raw input', data);
  data = selectInputPath(state, data, context);
  debug('[processStateInput] after selectInputPath', data);
  if (state.Type !== 'Map') {
    data = await buildArguments(state, data, context);
    debug('[processStateInput] after buildArguments', data);
    data = await buildParameters(state, data, context);
    debug('[processStateInput] after buildParameters', data);
  }
  return data;
}

async function processStateOutput(
  context: Context,
  state: State,
  input: StateData,
  output: StateData
) {
  let data = output;
  debug('[processStateOutput] state raw output', data);
  data = await buildResultSelector(state, data, context);
  debug('[processStateOutput] after buildResultSelector', data);
  data = buildResultPath(state, input, data);
  debug('[processStateOutput] after buildResultPath', data);
  data = await buildOutput(state, input, data, context);
  debug('[processStateOutput] after buildOutput', data);
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

async function buildArguments(state: State, input: StateData, context: Context) {
  if (hasArguments(state))
    return await replacePathTemplateFields(
      state.Arguments,
      input,
      context,
      undefined,
      undefined,
      context.StateEntryVariables
    );
  return input;
}

function hasArguments(state: State): state is State & { Arguments: Record<string, unknown> } {
  return 'Arguments' in state && typeof state.Arguments === 'object';
}

async function buildParameters(state: State, input: StateData, context: Context) {
  if (hasParameters(state))
    return await replacePathTemplateFields(
      state.Parameters,
      input,
      context,
      undefined,
      undefined,
      context.StateEntryVariables
    );
  return input;
}

function hasParameters(state: State): state is State & Required<ParametersField> {
  return 'Parameters' in state && typeof state.Parameters === 'object';
}

async function buildItemSelector(state: State, input: StateData, context: Context) {
  if (hasItemSelector(state))
    return await replacePathTemplateFields(
      state.ItemSelector,
      input,
      context,
      undefined,
      undefined,
      context.StateEntryVariables
    );
  return input;
}

function hasItemSelector(state: State): state is State & { ItemSelector: Record<string, unknown> } {
  return (
    'ItemSelector' in state && typeof state.ItemSelector === 'object' && state.ItemSelector !== null
  );
}
async function buildResultSelector(state: State, data: StateData, context: Context) {
  if (hasResultSelector(state))
    return await replacePathTemplateFields(
      state.ResultSelector,
      data,
      context,
      undefined,
      undefined,
      context.StateEntryVariables
    );
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
    try {
      const inputData = clone(input);
      updatePath(inputData, resultPath, output);
      return inputData;
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new ExecutionError(
        'States.ResultPathMatchFailure',
        `ResultPath could not be applied at ${resultPath}: ${cause}`
      );
    }
  }
}

function hasResultPath(state: State): state is State & Required<ResultPathField> {
  return 'ResultPath' in state && typeof state.ResultPath !== 'undefined';
}

async function buildOutput(state: State, input: StateData, output: StateData, context: Context) {
  if (hasOutput(state)) {
    return await replacePathTemplateFields(
      state.Output,
      input,
      context,
      output,
      undefined,
      context.StateEntryVariables
    );
  }
  return output;
}

function hasOutput(state: State): state is State & { Output: string | Record<string, unknown> } {
  return 'Output' in state && typeof state.Output !== 'undefined';
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

async function calculateWaitDelayInMs(
  context: Context,
  state: WaitState,
  input: StateData
): Promise<number> {
  const now = () => Date.parse(getRuntime(context).now());
  if ('Seconds' in state) {
    const seconds =
      getQueryLanguage(context, state) === 'JSONata'
        ? Number(await replacePathTemplateFields(state.Seconds, input, context))
        : Number(state.Seconds);
    return seconds * 1000;
  } else if ('SecondsPath' in state) {
    const secondsPath = state.SecondsPath;
    if (typeof secondsPath !== 'string') return 0;
    return getNumericPathValue(selectPath(secondsPath, input, context), secondsPath) * 1000;
  } else if ('Timestamp' in state) {
    const timestamp =
      getQueryLanguage(context, state) === 'JSONata'
        ? String(await replacePathTemplateFields(state.Timestamp, input, context))
        : state.Timestamp;
    if (typeof timestamp !== 'string') return 0;
    const date = Date.parse(timestamp);
    return Math.max(date - now(), 0);
  } else if ('TimestampPath' in state) {
    const timestampPath = state.TimestampPath;
    if (typeof timestampPath !== 'string') return 0;
    const timestamp = getStringPathValue(selectPath(timestampPath, input, context), timestampPath);
    const date = Date.parse(timestamp);
    return Math.max(date - now(), 0);
  } else {
    return 0;
  }
}

export function createBaseContext(
  {
    definition,
    resourceContext,
    executionContext,
    runtime: runtimeOverride,
  }: {
    definition: StateDefinition;
    resourceContext?: ResourceContext;
    executionContext?: ExecutionContext;
    runtime?: RuntimeAdapter;
  },
  initialInput: StateData
) {
  const runtime = runtimeOverride ?? createDefaultRuntime();
  const baseContext: BaseContext = {
    Resources: resourceContext,
    Runtime: runtime,
    StateMachine: {
      Id: `machine-${runtime.randomUUID()}`,
      Name: `machine`,
      QueryLanguage: definition.QueryLanguage ?? 'JSONPath',
    },
    Execution: {
      StartTime: runtime.now(),
      Id: `execution-${runtime.randomUUID()}`,
      Name: 'execution',
      RoleArn: 'machine-role',
      Input: initialInput,
      RedriveCount: 0,
      ...executionContext,
    },
    VariableScopes: [{}],
  };
  return baseContext;
}

function resolveJsonPointerTarget(value: unknown, pointer: string): unknown {
  if (pointer === '') return value;
  if (!pointer.startsWith('/')) {
    throw new ExecutionError('States.Runtime', `Invalid ItemsPointer: ${pointer}`);
  }

  let current: unknown = value;
  for (const token of pointer.slice(1).split('/')) {
    const segment = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      current = undefined;
    }
  }
  return current;
}

function applyReaderMaxItems(readerConfig: unknown, items: unknown[]): unknown[] {
  const maxItems =
    isRecord(readerConfig) && typeof readerConfig.MaxItems === 'number'
      ? readerConfig.MaxItems
      : undefined;
  return typeof maxItems === 'number' ? items.slice(0, maxItems) : items;
}

function getCsvDelimiter(readerConfig: unknown): string {
  const delimiter =
    isRecord(readerConfig) && typeof readerConfig.CSVDelimiter === 'string'
      ? readerConfig.CSVDelimiter
      : 'COMMA';
  switch (delimiter) {
    case 'COMMA':
      return ',';
    case 'PIPE':
      return '|';
    case 'SEMICOLON':
      return ';';
    case 'SPACE':
      return ' ';
    case 'TAB':
      return '\t';
    default:
      return ',';
  }
}

function parseCsvRecords(body: string, readerConfig: unknown): Array<Record<string, string>> {
  const delimiter = getCsvDelimiter(readerConfig);
  const lines = body.split(/\r?\n/).filter(line => line.length > 0);
  if (lines.length === 0) return [];

  const headerLocation =
    isRecord(readerConfig) && typeof readerConfig.CSVHeaderLocation === 'string'
      ? readerConfig.CSVHeaderLocation
      : 'FIRST_ROW';

  let headers: string[];
  let dataLines: string[];

  if (headerLocation === 'FIRST_ROW') {
    headers = lines[0].split(delimiter);
    dataLines = lines.slice(1);
  } else if (
    headerLocation === 'GIVEN' &&
    isRecord(readerConfig) &&
    Array.isArray(readerConfig.CSVHeaders) &&
    readerConfig.CSVHeaders.every(header => typeof header === 'string')
  ) {
    headers = readerConfig.CSVHeaders as string[];
    dataLines = lines;
  } else {
    throw new ExecutionError('States.Runtime', `Unsupported CSVHeaderLocation: ${headerLocation}`);
  }

  return dataLines.map(line => {
    const fields = line.split(delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? '']));
  });
}

function parseJsonLines(body: string): unknown[] {
  const lines = body.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => JSON.parse(line) as unknown);
}

async function processItemReader(
  context: Context,
  state: MapState,
  input: StateData
): Promise<{ items: unknown[]; source?: string; itemSources?: Array<string | undefined> }> {
  if (!('ItemReader' in state) || !state.ItemReader) {
    throw new ExecutionError('States.Runtime', 'ItemReader is required.');
  }

  const itemReader = state.ItemReader;
  const readerConfig = itemReader.ReaderConfig ?? {};
  const parameters =
    'Parameters' in itemReader && itemReader.Parameters
      ? await replacePathTemplateFields(itemReader.Parameters, input, context)
      : 'Arguments' in itemReader && typeof itemReader.Arguments !== 'undefined'
        ? await replacePathTemplateFields(itemReader.Arguments, input, context)
        : {};
  const inputType =
    isRecord(readerConfig) && typeof readerConfig.InputType === 'string'
      ? readerConfig.InputType
      : undefined;

  if (itemReader.Resource === 'arn:aws:states:::s3:getObject') {
    if (inputType === 'PARQUET') {
      if (isRecord(parameters) && typeof parameters.VersionId !== 'undefined') {
        throw new ExecutionError(
          'States.ItemReaderFailed',
          'S3 Version ID selection is not currently supported for PARQUET files'
        );
      }
      throw new ExecutionError(
        'States.Runtime',
        'Local ItemReader does not support PARQUET input.'
      );
    }

    const payload = await context.Resources?.invoke(itemReader.Resource, parameters);
    const body = isRecord(payload) && 'Body' in payload ? payload.Body : payload;
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

    if (inputType === 'CSV') {
      return {
        items: applyReaderMaxItems(readerConfig, parseCsvRecords(bodyString, readerConfig)),
      };
    }

    if (inputType === 'JSONL') {
      return {
        items: applyReaderMaxItems(readerConfig, parseJsonLines(bodyString)),
      };
    }

    const parsed = JSON.parse(bodyString) as unknown;
    const itemsPointer =
      isRecord(readerConfig) && typeof readerConfig.ItemsPointer === 'string'
        ? readerConfig.ItemsPointer
        : undefined;
    const selected = itemsPointer ? resolveJsonPointerTarget(parsed, itemsPointer) : parsed;
    if (!Array.isArray(selected)) {
      throw new ExecutionError('States.Runtime', 'ItemReader JSON input must resolve to an array.');
    }
    return { items: applyReaderMaxItems(readerConfig, selected), source: undefined };
  }

  if (itemReader.Resource === 'arn:aws:states:::s3:listObjectsV2') {
    const payload = await context.Resources?.invoke(itemReader.Resource, parameters);
    const bucket =
      isRecord(parameters) && typeof parameters.Bucket === 'string' ? parameters.Bucket : undefined;
    const baseSource = bucket ? `s3://${bucket}` : undefined;
    const listed = isRecord(payload) && Array.isArray(payload.Contents) ? payload.Contents : [];
    const transformation =
      isRecord(readerConfig) && typeof readerConfig.Transformation === 'string'
        ? readerConfig.Transformation
        : 'NONE';

    if (transformation === 'NONE') {
      return { items: listed, source: baseSource };
    }

    if (transformation === 'LOAD_AND_FLATTEN') {
      if (inputType === 'PARQUET') {
        throw new ExecutionError(
          'States.Runtime',
          'Local ItemReader does not support PARQUET input.'
        );
      }

      const flattened: Array<{ value: unknown; source?: string }> = [];
      for (const entry of listed) {
        const key = isRecord(entry) && typeof entry.Key === 'string' ? entry.Key : undefined;
        const objectPayload = await context.Resources?.invoke('arn:aws:states:::s3:getObject', {
          ...(isRecord(parameters) ? parameters : {}),
          Key: key,
        });
        const objectBody =
          isRecord(objectPayload) && 'Body' in objectPayload ? objectPayload.Body : objectPayload;
        const objectString =
          typeof objectBody === 'string' ? objectBody : JSON.stringify(objectBody);
        const parsed = JSON.parse(objectString) as unknown;
        const records = Array.isArray(parsed) ? parsed : [parsed];
        for (const record of records) {
          flattened.push({
            value: record,
            source: key && bucket ? `s3://${bucket}/${key}` : undefined,
          });
        }
      }
      return {
        items: flattened.map(item => item.value),
        source: undefined,
        itemSources: flattened.map(item => item.source),
      };
    }

    throw new ExecutionError(
      'States.Runtime',
      `Unsupported ItemReader transformation: ${transformation}`
    );
  }

  throw new ExecutionError(
    'States.Runtime',
    `Unsupported ItemReader resource: ${itemReader.Resource}`
  );
}

export function createMapContext(
  context: Context,
  itemIndex: number,
  itemValue: unknown,
  itemSource?: string
): Context {
  return {
    ...context,
    VariableScopes: [...(context.VariableScopes ?? []), {}],
    Map: {
      Item: {
        Index: itemIndex,
        Value: itemValue,
        ...(itemSource ? { Source: itemSource } : {}),
      },
    },
  };
}

export function createContext(baseContext: BaseContext, state: State, stateName: string): Context {
  const enteredTime = getRuntime(baseContext).now();
  const taskContext =
    state.Type === 'Task'
      ? {
          Token: `TaskToken-${getRuntime(baseContext).randomUUID()}`,
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
