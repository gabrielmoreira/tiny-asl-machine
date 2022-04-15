export type StateDefinition = {
  Comment?: string;
  StartAt: string;
  States: StatesDefinition;
};

export type StatesDefinition = Record<string, State>;

export type State =
  | TaskState
  | ParallelState
  | MapState
  | PassState
  | WaitState
  | ChoiceState
  | SucceedState
  | FailState;

export type StateType = State['Type'];

export type TaskState = CommentField &
  InputPathField &
  ParametersField &
  ResultSelectorField &
  ResultPathField &
  OutputPathField &
  RetryField &
  CatchField &
  EndOrNextField &
  TimeoutFields & {
    Type: 'Task';
    Resource: string;
  };
export type ParallelState = CommentField &
  InputPathField &
  ParametersField &
  ResultSelectorField &
  ResultPathField &
  OutputPathField &
  RetryField &
  CatchField &
  EndOrNextField & {
    Type: 'Parallel';
    Branches: StateDefinition[];
  };
export type MapState = CommentField &
  InputPathField &
  ParametersField &
  ResultSelectorField &
  ResultPathField &
  OutputPathField &
  RetryField &
  CatchField &
  EndOrNextField & {
    Type: 'Map';
    Iterator: StateDefinition;
    ItemsPath?: string;
    MaxConcurrency?: number;
  };
export type PassState = CommentField &
  InputPathField &
  ParametersField &
  ResultPathField &
  OutputPathField &
  EndOrNextField & {
    Type: 'Pass';
    Result?: unknown;
  };
export type WaitState = CommentField &
  InputPathField &
  OutputPathField &
  EndOrNextField &
  WaitStateFields & {
    Type: 'Wait';
  };
export type ChoiceState = CommentField &
  InputPathField &
  OutputPathField & {
    Type: 'Choice';
    Choices: TopLevelChoiceRule[];
    Default?: string;
  };
export type SucceedState = CommentField &
  InputPathField &
  OutputPathField & {
    Type: 'Succeed';
  };
export type FailState = CommentField & {
  Type: 'Fail';
  Error: string;
  Cause: string;
};

// -- STATE FIELDS --
export type CommentField = {
  Comment?: string;
};
export type InputPathField = {
  InputPath?: string;
};
export type ParametersField = {
  Parameters?: Record<string, unknown>;
};
export type ResultPathField = {
  ResultPath?: string | null;
};
export type ResultSelectorField = {
  ResultSelector?: Record<string, unknown>;
};
export type OutputPathField = {
  OutputPath?: string;
};
export type RetryField = {
  Retry?: Retrier[];
};
export type CatchField = {
  Catch?: Catcher[];
};

export type NextField = { Next: string };
export type EndField = { End: true };
export type EndOrNextField = EndField | NextField;

export type TimeoutSecondsField = {
  TimeoutSeconds?: number;
};
export type HeartbeatSecondsField = {
  HeartbeatSeconds?: number;
};
export type TimeoutSecondsPathField = {
  TimeoutSecondsPath?: string;
};
export type HeartbeatSecondsPathField = {
  HeartbeatSecondsPath?: string;
};
export type TimeoutFields =
  | (TimeoutSecondsField & HeartbeatSecondsField)
  | (TimeoutSecondsField & HeartbeatSecondsPathField)
  | (TimeoutSecondsPathField & HeartbeatSecondsField)
  | (TimeoutSecondsPathField & HeartbeatSecondsPathField);

export type WaitStateFields =
  | { Seconds: number }
  | { SecondsPath: string }
  | { Timestamp: string }
  | { TimestampPath: string };

export type ErrorName =
  | 'States.ALL' // A wildcard which matches any Error Name.
  | 'States.HeartbeatTimeout' // A Task State failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
  | 'States.Timeout' // A Task State either ran longer than the "TimeoutSeconds" value, or failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
  | 'States.TaskFailed' // A Task State failed during the execution.
  | 'States.Permissions' // A Task State failed because it had insufficient privileges to execute the specified code.
  | 'States.ResultPathMatchFailure' // A state’s "ResultPath" field cannot be applied to the input the state received.
  | 'States.ParameterPathFailure' // Within a state’s "Parameters" field, the attempt to replace a field whose name ends in ".$" using a Path failed.
  | 'States.BranchFailed' // A branch of a Parallel State failed.
  | 'States.NoChoiceMatched' // A Choice State failed to find a match for the condition field extracted from its input.
  | 'States.IntrinsicFailure' // Within a Payload Template, the attempt to invoke an Intrinsic Function failed.
  | string;

export type Retrier = {
  ErrorEquals: ErrorName[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
};
export type Catcher = ResultPathField & {
  ErrorEquals: ErrorName[];
  Next: string;
};
export type TopLevelChoiceRule = {
  Next: string;
} & ChoiceRule;

export type ChoiceRule = BooleanExpression | DataTestExpression;

export type BooleanExpression =
  | {
      And: ChoiceRule[];
    }
  | {
      Or: ChoiceRule[];
    }
  | {
      Not: ChoiceRule;
    };
export type DataTestExpression = { Variable: string } & (
  | {
      [k in IsOperator]?: boolean;
    }
  | {
      [k in StringOperator]?: string;
    }
  | {
      [k in StringPathOperator]?: string;
    }
  | {
      [k in NumericOperator]?: number;
    }
  | {
      [k in NumericPathOperator]?: string;
    }
  | {
      [k in BooleanOperator]?: boolean;
    }
  | {
      [k in BooleanPathOperator]?: string;
    }
  | {
      [k in TypestampOperator]?: string;
    }
  | {
      [k in TypestampPathOperator]?: string;
    }
);

export type StringOperator =
  | 'StringEquals'
  | 'StringLessThan'
  | 'StringGreaterThan'
  | 'StringLessThanEquals'
  | 'StringGreaterThanEquals'
  | 'StringMatches';
export type StringPathOperator =
  | 'StringEqualsPath'
  | 'StringLessThanPath'
  | 'StringGreaterThanPath'
  | 'StringLessThanEqualsPath'
  | 'StringGreaterThanEqualsPath';
export type NumericOperator =
  | 'NumericEquals'
  | 'NumericLessThan'
  | 'NumericGreaterThan'
  | 'NumericLessThanEquals'
  | 'NumericGreaterThanEquals';
export type NumericPathOperator =
  | 'NumericEqualsPath'
  | 'NumericLessThanPath'
  | 'NumericGreaterThanPath'
  | 'NumericLessThanEqualsPath'
  | 'NumericGreaterThanEqualsPath';
export type BooleanOperator = 'BooleanEquals';
export type BooleanPathOperator = 'BooleanEqualsPath';
export type TypestampOperator =
  | 'TimestampEquals'
  | 'TimestampLessThan'
  | 'TimestampGreaterThan'
  | 'TimestampLessThanEquals'
  | 'TimestampGreaterThanEquals';
export type TypestampPathOperator =
  | 'TimestampEqualsPath'
  | 'TimestampLessThanPath'
  | 'TimestampGreaterThanPath'
  | 'TimestampLessThanEqualsPath'
  | 'TimestampGreaterThanEqualsPath';
export type IsOperator =
  | 'IsNull'
  | 'IsPresent'
  | 'IsNumeric'
  | 'IsString'
  | 'IsBoolean'
  | 'IsTimestamp';

export type LogicOperator = 'And' | 'Or' | 'Not';

export type Operator =
  | LogicOperator
  | StringOperator
  | NumericOperator
  | NumericPathOperator
  | BooleanOperator
  | BooleanPathOperator
  | TypestampOperator
  | TypestampPathOperator
  | IsOperator;

export type IntrinsicFunctions =
  | 'States.Format'
  | 'States.StringToJson'
  | 'States.JsonToString'
  | 'States.Array';
