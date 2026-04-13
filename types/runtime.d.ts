import type { EndOrNextField, Operator, State, StateType, TopLevelChoiceRule } from './asl';

export type ResourceContext = {
  invoke: (resource: string, payload: unknown) => Promise<unknown>;
};

export type StateExecutors = Record<StateType, StateExecutor>;

export type StateExecutor = (
  context: Context,
  state: State,
  input: StateData
) => Promise<StateData>;

export type StateMachineContext = {
  Id: string;
  Name: string;
};

export type ExecutionContext = {
  Id: string;
  Input: unknown;
  StartTime: string;
  Name: string;
  RoleArn: string;
};

export type StateExecutionContext = {
  EnteredTime: string;
  Name?: string;
  RetryCount: number;
};

export type TaskStateContext = {
  Token: string;
};

export type MapStateContext = {
  Item: {
    Index: number;
    Value: unknown;
  };
};


export type RuntimeAdapter = {
  /** Returns current time as ISO 8601 string */
  now: () => string;
  /** Delays execution by the given number of milliseconds */
  sleep: (ms: number) => Promise<void>;
  /** Generates a v4 UUID */
  randomUUID: () => string;
  /** Returns a random integer between min and max (inclusive) */
  random: (min: number, max: number) => number;
  /** Computes a hash of the data using the given algorithm (MD5, SHA-1, SHA-256, SHA-384, SHA-512) */
  hash: (data: string, algorithm: string) => string;
  /** Base64-encodes a string */
  base64Encode: (data: string) => string;
  /** Base64-decodes a string */
  base64Decode: (data: string) => string;
};

export type BaseContext = {
  StateMachine: StateMachineContext;
  Execution: ExecutionContext;
  Resources?: ResourceContext;
  Runtime?: RuntimeAdapter;
  Transition?: EndOrNextField;
};

export type Context = BaseContext & {
  State: StateExecutionContext;
  Task?: TaskStateContext;
  Map?: MapStateContext;
  ExecutionError?: ExecutionErrorContext;
};

export type StateData = unknown;

export type ChoiceOperators = {
  [key in Operator]: ChoiceOperator;
};

export type ChoiceOperator = (
  context: Context,
  input: StateData,
  choice: TopLevelChoiceRule
) => unknown;

export type ExecutionErrorContext = {
  Error: string;
  Cause: string;
};
