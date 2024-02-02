import { EndOrNextField, Operator, State, StateType, TopLevelChoiceRule } from './asl';

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

export type BaseContext = {
  Resources: ResourceContext;
  StateMachine: StateMachineContext;
  Execution: ExecutionContext;
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
