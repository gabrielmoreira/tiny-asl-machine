export type QueryLanguage = 'JSONPath' | 'JSONata';

export type StateDefinition = JsonPathStateDefinition | JsonataStateDefinition;

export type JsonPathStateDefinition = {
  Comment?: string;
  QueryLanguage?: 'JSONPath';
  Version?: string;
  TimeoutSeconds?: number;
  StartAt: string;
  States: JsonPathStatesDefinition;
};

export type JsonataStateDefinition = {
  Comment?: string;
  QueryLanguage: 'JSONata';
  Version?: string;
  TimeoutSeconds?: number;
  StartAt: string;
  States: JsonataStatesDefinition;
};

export type StatesDefinition = Record<string, State>;
export type JsonPathStatesDefinition = Record<string, JsonPathState | ExplicitJsonataState>;
export type JsonataStatesDefinition = Record<string, JsonataState | ExplicitJsonPathState>;

export type State = JsonPathState | JsonataState | ExplicitJsonPathState | ExplicitJsonataState;

export type JsonPathState =
  | JsonPathTaskState
  | JsonPathParallelState
  | JsonPathMapState
  | JsonPathPassState
  | JsonPathWaitState
  | JsonPathChoiceState
  | JsonPathSucceedState
  | JsonPathFailState;
export type JsonataState =
  | JsonataTaskState
  | JsonataParallelState
  | JsonataMapState
  | JsonataPassState
  | JsonataWaitState
  | JsonataChoiceState
  | JsonataSucceedState
  | JsonataFailState;

export type StateType = State['Type'];

export type ExplicitJsonPathState = RequireQueryLanguage<JsonPathState, 'JSONPath'>;
export type ExplicitJsonataState = RequireQueryLanguage<JsonataState, 'JSONata'>;

export type TaskState = JsonPathTaskState | JsonataTaskState;
export type ParallelState = JsonPathParallelState | JsonataParallelState;
export type MapState = JsonPathMapState | JsonataMapState;
export type PassState = JsonPathPassState | JsonataPassState;
export type WaitState = JsonPathWaitState | JsonataWaitState;
export type ChoiceState = JsonPathChoiceState | JsonataChoiceState;
export type SucceedState = JsonPathSucceedState | JsonataSucceedState;
export type FailState = JsonPathFailState | JsonataFailState;

export type JsonPathTaskState = JsonPathStateFields &
  RetryField<JsonPathRetrier> &
  CatchField<JsonPathCatcher> &
  EndOrNextField &
  TimeoutFields & {
    Type: 'Task';
    Resource: string;
  };

export type JsonataTaskState = JsonataStateFields &
  ArgumentsField &
  RetryField<JsonataRetrier> &
  CatchField<JsonataCatcher> &
  EndOrNextField &
  TimeoutFields & {
    Type: 'Task';
    Resource: string;
  };

export type JsonPathParallelState = JsonPathStateFields &
  RetryField<JsonPathRetrier> &
  CatchField<JsonPathCatcher> &
  EndOrNextField & {
    Type: 'Parallel';
    Branches: StateDefinition[];
  };

export type JsonataParallelState = JsonataStateFields &
  ArgumentsField &
  RetryField<JsonataRetrier> &
  CatchField<JsonataCatcher> &
  EndOrNextField & {
    Type: 'Parallel';
    Branches: StateDefinition[];
  };

export type JsonPathMapState = JsonPathMapCommonFields &
  RetryField<JsonPathRetrier> &
  CatchField<JsonPathCatcher> &
  EndOrNextField;

export type JsonataMapState = JsonataMapCommonFields &
  RetryField<JsonataRetrier> &
  CatchField<JsonataCatcher> &
  EndOrNextField;

export type JsonPathPassState = JsonPathPassStateFields &
  EndOrNextField & {
    Type: 'Pass';
    Result?: unknown;
  };

export type JsonataPassState = JsonataBaseStateFields &
  AssignField &
  EndOrNextField & {
    Type: 'Pass';
    Output?: string | Record<string, unknown>;
  };

export type JsonPathWaitState = JsonPathBaseStateFields &
  AssignField &
  OutputPathField &
  EndOrNextField &
  JsonPathWaitStateFields & {
    Type: 'Wait';
  };

export type JsonataWaitState = JsonataBaseStateFields &
  AssignField &
  OutputField &
  EndOrNextField &
  JsonataWaitStateFields & {
    Type: 'Wait';
  };

export type JsonPathChoiceState = JsonPathBaseStateFields &
  AssignField &
  OutputPathField & {
    Type: 'Choice';
    Choices: TopLevelChoiceRule[];
    Default?: string;
  };

export type JsonataChoiceState = JsonataBaseStateFields &
  AssignField &
  OutputField & {
    Type: 'Choice';
    Choices: JsonataChoiceRule[];
    Default?: string;
  };

export type JsonPathSucceedState = JsonPathBaseStateFields &
  OutputPathField & {
    Type: 'Succeed';
  };

export type JsonataSucceedState = JsonataBaseStateFields &
  OutputField & {
    Type: 'Succeed';
  };

export type JsonPathFailState = JsonPathQueryLanguageField &
  CommentField &
  JsonPathFailFields & {
    Type: 'Fail';
  };

export type JsonataFailState = JsonataQueryLanguageField &
  CommentField & {
    Type: 'Fail';
    Error?: string;
    Cause?: string;
  };

export type JsonPathBaseStateFields = JsonPathQueryLanguageField & CommentField & InputPathField;
export type JsonataBaseStateFields = JsonataQueryLanguageField & CommentField;

export type JsonPathStateFields = JsonPathBaseStateFields &
  AssignField &
  ParametersField &
  ResultSelectorField &
  ResultPathField &
  OutputPathField;

export type JsonataStateFields = JsonataBaseStateFields & AssignField & OutputField;

export type JsonPathPassStateFields = JsonPathBaseStateFields &
  AssignField &
  ParametersField &
  ResultPathField &
  OutputPathField;

export type JsonPathMapCommonFields = JsonPathStateFields &
  MapProcessorField & {
    Type: 'Map';
    ItemsPath?: string;
    Parameters?: Record<string, unknown>;
    ItemSelector?: Record<string, unknown>;
    ItemReader?: JsonPathItemReader;
    ItemBatcher?: JsonPathItemBatcher;
    ResultWriter?: JsonPathResultWriter;
  } & JsonPathMapConcurrencyFields &
  JsonPathMapFailureToleranceFields;

export type JsonataMapCommonFields = JsonataStateFields &
  MapProcessorField & {
    Type: 'Map';
    Items?: unknown[] | string;
    ItemSelector?: unknown;
    ItemReader?: JsonataItemReader;
    ItemBatcher?: JsonataItemBatcher;
    ResultWriter?: JsonataResultWriter;
  } & JsonataMapConcurrencyFields &
  JsonataMapFailureToleranceFields;

export type MapProcessorField =
  | {
      ItemProcessor: MapProcessorDefinition;
      Iterator?: StateDefinition;
    }
  | {
      Iterator: StateDefinition;
      ItemProcessor?: MapProcessorDefinition;
    };

export type MapProcessorDefinition = StateDefinition & {
  ProcessorConfig?: Record<string, unknown>;
};

export type JsonPathItemReader = {
  Resource: string;
  ReaderConfig?: JsonPathReaderConfig;
  Parameters?: Record<string, unknown>;
};

export type JsonataItemReader = {
  Resource: string;
  ReaderConfig?: JsonataReaderConfig;
  Arguments?: Record<string, unknown> | string;
};

export type JsonPathReaderConfig =
  | ({ MaxItems?: number; MaxItemsPath?: never } & Record<string, unknown>)
  | ({ MaxItems?: never; MaxItemsPath?: string } & Record<string, unknown>)
  | Record<string, unknown>;

export type JsonataReaderConfig = {
  MaxItems?: number | string;
} & Record<string, unknown>;

export type JsonPathItemBatcher = JsonPathBatchInputField &
  RequireAtLeastOne<{
    MaxItemsPerBatch?: number;
    MaxItemsPerBatchPath?: string;
    MaxInputBytesPerBatch?: number;
    MaxInputBytesPerBatchPath?: string;
  }>;

export type JsonataItemBatcher = JsonataBatchInputField &
  RequireAtLeastOne<{
    MaxItemsPerBatch?: number | string;
    MaxInputBytesPerBatch?: number | string;
  }>;

export type JsonPathResultWriter = {
  Resource: string;
  Parameters?: Record<string, unknown>;
};

export type JsonataResultWriter = {
  Resource: string;
  Arguments?: Record<string, unknown> | string;
};

export type JsonPathMapConcurrencyFields =
  | {
      MaxConcurrency?: number;
      MaxConcurrencyPath?: never;
    }
  | {
      MaxConcurrency?: never;
      MaxConcurrencyPath?: string;
    }
  | Record<string, never>;

export type JsonataMapConcurrencyFields = {
  MaxConcurrency?: number | string;
};

export type JsonPathMapFailureToleranceFields = ToleratedFailureCountField &
  ToleratedFailurePercentageField;

export type JsonataMapFailureToleranceFields = {
  ToleratedFailureCount?: number | string;
  ToleratedFailurePercentage?: number | string;
};

export type ToleratedFailureCountField =
  | {
      ToleratedFailureCount?: number;
      ToleratedFailureCountPath?: never;
    }
  | {
      ToleratedFailureCount?: never;
      ToleratedFailureCountPath?: string;
    }
  | Record<string, never>;

export type ToleratedFailurePercentageField =
  | {
      ToleratedFailurePercentage?: number;
      ToleratedFailurePercentagePath?: never;
    }
  | {
      ToleratedFailurePercentage?: never;
      ToleratedFailurePercentagePath?: string;
    }
  | Record<string, never>;

export type JsonataWaitStateFields =
  | { Seconds: number | string; Timestamp?: never }
  | { Seconds?: never; Timestamp: string };
export type JsonPathWaitStateFields =
  | { Seconds: number; SecondsPath?: never; Timestamp?: never; TimestampPath?: never }
  | { Seconds?: never; SecondsPath: string; Timestamp?: never; TimestampPath?: never }
  | { Seconds?: never; SecondsPath?: never; Timestamp: string; TimestampPath?: never }
  | { Seconds?: never; SecondsPath?: never; Timestamp?: never; TimestampPath: string };

export type JsonPathFailFields = ErrorSourceField & CauseSourceField;
export type ErrorSourceField =
  | { Error?: string; ErrorPath?: never }
  | { Error?: never; ErrorPath?: string }
  | Record<string, never>;
export type CauseSourceField =
  | { Cause?: string; CausePath?: never }
  | { Cause?: never; CausePath?: string }
  | Record<string, never>;

// -- STATE FIELDS --
export type QueryLanguageField = {
  QueryLanguage?: QueryLanguage;
};
export type JsonPathQueryLanguageField = {
  QueryLanguage?: 'JSONPath';
};
export type JsonataQueryLanguageField = {
  QueryLanguage?: 'JSONata';
};
export type CommentField = {
  Comment?: string;
};
export type InputPathField = {
  InputPath?: string;
};
export type AssignField = {
  Assign?: Record<string, unknown>;
};
export type ParametersField = {
  Parameters?: Record<string, unknown>;
};
export type ArgumentsField = {
  Arguments?: Record<string, unknown> | string;
};
export type ResultPathField = {
  ResultPath?: string | null;
};
export type ResultSelectorField = {
  ResultSelector?: Record<string, unknown>;
};
export type OutputField = {
  Output?: string | Record<string, unknown>;
};
export type OutputPathField = {
  OutputPath?: string;
};
export type RetryField<T extends Retrier = Retrier> = {
  Retry?: T[];
};
export type CatchField<T extends Catcher = Catcher> = {
  Catch?: T[];
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

export type WaitStateFields = JsonataWaitStateFields | JsonPathWaitStateFields;

export type KnownErrorName =
  | 'States.ALL' // A wildcard which matches any Error Name.
  | 'States.HeartbeatTimeout' // A Task State failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
  | 'States.Timeout' // A Task State either ran longer than the "TimeoutSeconds" value, or failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
  | 'States.TaskFailed' // A Task State failed during the execution.
  | 'States.Permissions' // A Task State failed because it had insufficient privileges to execute the specified code.
  | 'States.ResultPathMatchFailure' // A state’s "ResultPath" field cannot be applied to the input the state received.
  | 'States.ParameterPathFailure' // Within a state’s "Parameters" field, the attempt to replace a field whose name ends in ".$" using a Path failed.
  | 'States.BranchFailed' // A branch of a Parallel State failed.
  | 'States.NoChoiceMatched' // A Choice State failed to find a match for the condition field extracted from its input.
  | 'States.IntrinsicFailure'; // Within a Payload Template, the attempt to invoke an Intrinsic Function failed.

export type ErrorName = KnownErrorName | (string & {});

export type JsonPathRetrier = {
  ErrorEquals: ErrorName[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  MaxDelaySeconds?: number;
  JitterStrategy?: string;
  BackoffRate?: number;
};

export type JsonataRetrier = JsonPathRetrier;
export type Retrier = JsonPathRetrier;

export type JsonPathCatcher = ResultPathField &
  AssignField & {
    ErrorEquals: ErrorName[];
    Next: string;
  };

export type JsonataCatcher = OutputField &
  AssignField & {
    ErrorEquals: ErrorName[];
    Next: string;
  };

export type Catcher = JsonPathCatcher | JsonataCatcher;

export type JsonataChoiceRule = AssignField & {
  Condition: string | boolean;
  Next: string;
  Output?: string | Record<string, unknown>;
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

export type JsonPathBatchInputField = {
  BatchInput?: Record<string, unknown>;
};

export type JsonataBatchInputField = {
  BatchInput?: unknown;
};

export type RequireQueryLanguage<T, Q extends QueryLanguage> = T extends unknown
  ? Omit<T, 'QueryLanguage'> & { QueryLanguage: Q }
  : never;

export type RequireAtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];
