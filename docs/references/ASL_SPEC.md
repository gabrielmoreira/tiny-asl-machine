# Amazon States Language

This document describes a [JSON](https://tools.ietf.org/html/rfc8259 'RFC 8259')\-based language used to describe state machines declaratively. The state machines thus defined may be executed by software. In this document, the software is referred to as "the interpreter".

Copyright © 2016-2024 Amazon.com Inc. or Affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy of this specification and associated documentation files (the "specification"), to use, copy, publish, and/or distribute, the Specification subject to the following conditions:

The preceding copyright notice and this permission notice shall be included in all copies of the Specification.

You may not modify, merge, sublicense, and/or sell copies of the Specification.

THE SPECIFICATION IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SPECIFICATION OR THE USE OR OTHER DEALINGS IN THE SPECIFICATION.​

Any sample code included in the Specification, unless otherwise specified, is licensed under the Apache License, Version 2.0.

## Table of Contents

- [Structure of a State Machine](#structure-of-a-state-machine)
  - [Example: Hello World](#example)
  - [Top-level fields](#toplevelfields)
- [Concepts](#concepts)
  - [States](#states-fields)
  - [Transitions](#transition)
  - [Timestamps](#timestamps)
  - [Data](#data)
  - [The Context Object](#context-object)
  - [Query Languages](#query-language)
  - [State Machine Variables](#state-machine-variables)
- [JSONata Concepts](#jsonata-concepts)
  - [Expressions](#expressions)
  - [Reserved "states" Variable with JSONata](#reserved-states-variable-with-jsonata)
  - [Input and Output Processing with JSONata](#input-and-output-processing-with-jsonata)
  - [JSONata Evaluation](#jsonata-evaluation)
  - [JSONata Runtime Errors](#jsonata-runtime-errors)
  - [JSONata Restrictions](#jsonata-restrictions)
- [JSONPath Concepts](#jsonpath-concepts)
  - [Paths](#path)
  - [Reference Paths](#ref-paths)
  - [Payload Template](#payload-template)
  - [Intrinsic Functions](#intrinsic-functions)
  - [Reserved "states" Variable with JSONPath](#reserved-states-variable-with-jsonpath)
  - [Input and Output Processing with JSONPath](#filters)
- [Error Handling](#error-handling)
  - [Errors](#errors)
  - [Retrying after error](#retrying-after-error)
  - [Fallback states](#fallback-states)
- [State Types](#state-types)
  - [Table of State Types and Fields (JSONata)](#state-type-table-jsonata)
  - [Table of State Types and Fields (JSONPath)](#state-type-table-jsonpath)
  - [Pass State](#pass-state)
  - [Task State](#task-state)
  - [Choice State](#choice-state)
  - [Wait State](#wait-state)
  - [Succeed State](#succeed-state)
  - [Fail State](#fail-state)
  - [Parallel State](#parallel-state)
  - [Map State](#map-state)
- [Appendices](#appendices)
  - [Appendix A: Predefined Error Codes](#appendix-a)
  - [Appendix B: List of JSONPath Intrinsic Functions](#appendix-b)
- [Document History](#document-history)
  - [November 22, 2024](#november-22-2024)
  - [September 7, 2023](#september-7-2023)
  - [December 1, 2022](#2022-12-01)
  - [November 18, 2022](#2022-11-18)
  - [August 31, 2022](#2022-08-31)
  - [August 11, 2020](#2020-08-11)

## Structure of a State Machine

A State Machine is represented by a [JSON Object](https://tools.ietf.org/html/rfc8259#section-4 'RFC 8259 JSON Object').

### Example: Hello World

The operation of a state machine is specified by states, which are represented by JSON objects, fields in the top-level "States" object. In this example, there is one state named "Hello World".

```
{
  "Comment": "A simple minimal example of the States language",
  "StartAt": "Hello World",
  "States": {
    "Hello World": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
      "End": true
    }
  }
}

```

When this state machine is launched, the interpreter begins execution by identifying the Start State. It executes that state, and then checks to see if the state is marked as an End State. If the state is an End State, the interpreter terminates the machine and returns its result. If the state is not an End State, the interpreter looks for a "Next" field, or a "Default" field in a Choice State, to determine which state to execute next; it repeats this process until the machine reaches a [Terminal State](#terminal-state) (Succeed, Fail, or an End State) or a runtime error occurs.

In this example, the machine contains a single state named "Hello World". Because "Hello World" is a Task State, the interpreter tries to execute it. Examining the value of the "Resource" field shows that it points to a Lambda function, so the interpreter attempts to invoke that function. Assuming the Lambda function executes successfully, the machine will terminate successfully.

### Top-level fields

A State Machine MUST have an object field named "States", whose fields represent the states.

A State Machine MUST have a string field named "StartAt", whose value MUST match exactly the name of one of the "States" fields. The interpreter starts executing the machine at the named state.

A State Machine MAY have a string field named "QueryLanguage", which provides the name of the _query language_ used in the machine. A query language is a language used to query, transform, or create JSON data. The States Language supports JSONPath and JSONata, and if omitted, the default value of "QueryLanguage" is "JSONPath". This document refers to the value of the top-level "QueryLanguage" field as the "state machine's query language".

A State Machine MAY have a string field named "Comment", to hold a human-readable comment or description of the machine.

A State Machine MAY have a string field named "Version", which gives the version of the States Language used in the machine. This document describes version 1.0, and if omitted, the default value of "Version" is "1.0".

A State Machine MAY have an integer field named "TimeoutSeconds". If provided, it provides the maximum number of seconds the machine is allowed to execute. If the machine executes longer than the specified time, then the interpreter fails the machine with a `States.Timeout` [Error Name](#error-names).

## Concepts

### States

States describe tasks (units of work), or specify flow control (for example, a Choice State) and are represented as fields of the top-level "States" object. The state name is the JSON field name. The state name MUST be unique within the scope of the entire state machine, and its length MUST BE less than or equal to 80 Unicode characters.

The following shows an example state definition:

```
"HelloWorld": {
  "Type": "Task",
  "QueryLanguage": "JSONPath",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
  "Next": "NextState",
  "Comment": "Executes the HelloWorld Lambda function"
}

```

Note that:

1.  All states MUST have a "Type" field. This document refers to the values of this field as a state’s _type_, and to a state such as the one in the previous example as a Task State.
2.  Any state MAY have a "Comment" field, to hold a human-readable comment or description.
3.  Any state MAY have a "QueryLanguage" field to override the state machine's query language as specified in the top-level "QueryLanguage" field. This document refers to the value of a state's "QueryLanguage" field (or the state machine's query language if not provided) as a "state's query language", and to a state such as the one in the previous example as a JSONPath Task State.
4.  Most state types require additional fields as specified in this document.
5.  Any state except for Choice, Succeed, and Fail MAY have a field named "End" whose value MUST be a boolean. The term "Terminal State" means a state with `{ "End": true }`, or a state with `{ "Type": "Succeed" }`, or a state with `{ "Type": "Fail" }`.

### Transitions

Transitions link states together, defining the control flow for the state machine. After executing a non-terminal state, the interpreter follows a transition to the next state. For most state types, transitions are unconditional and specified through the state's "Next" field.

All non-terminal states MUST have a "Next" field, except for the Choice State. The value of the "Next" field MUST exactly and case-sensitively match the name of another state.

States can have multiple incoming transitions from other states.

### Timestamps

The Choice and Wait States deal with JSON field values which represent timestamps. These are strings which MUST conform to the [RFC3339](https://www.ietf.org/rfc/rfc3339.txt 'RFC 3339') profile of ISO 8601, with the further restrictions that an uppercase "T" character MUST be used to separate date and time, and an uppercase "Z" character MUST be present in the absence of a numeric time zone offset, for example "2016-03-14T01:59:00Z".

### Data

The interpreter passes data between states to perform calculations or to dynamically control the state machine’s flow. All such data MUST be expressed in JSON. This document uses the term "JSON text" as defined in [RFC 8259](https://tools.ietf.org/html/rfc8259#section-2 'RFC 8259 JSON Text') to refer to data expressed in JSON.

When a state machine is started, the caller can provide an initial JSON text as input, which is passed to the machine's start state as input. If no input is provided, the default is an empty JSON object, `{}`. As each state is executed, it receives a JSON text as input and can produce arbitrary output, which MUST be a JSON text. When two states are linked by a transition, the output from the first state is passed as input to the second state. The output from the machine's terminal state is treated as its output.

For example, consider a simple state machine that adds two numbers together:

```
{
  "StartAt": "Add",
  "States": {
    "Add": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:Add",
      "End": true
    }
  }
}

```

Suppose the "Add" Lambda function is defined as:

```
export const handler = async (event) => {
  return event.val1 + event.val2;
};

```

Then if this state machine was started with the input `{ "val1": 3, "val2": 4 }`, then the output would be the JSON text consisting of the number `7`.

The usual constraints applying to JSON-encoded data apply. In particular, note that:

1.  Numbers in JSON generally conform to JavaScript semantics, typically corresponding to double-precision IEEE-854 values. For this and other interoperability concerns, see [RFC 8259](https://tools.ietf.org/html/rfc8259 'RFC 8259').
2.  Standalone quote-delimited (") strings, booleans, and numbers are valid JSON texts.

### The Context Object

The interpreter can provide information to an executing state machine about the execution and other implementation details. This is delivered in the form of a JSON object called the "Context Object". This version of the States Language specification does not specify any contents of the Context Object.

### Query Languages

A query language is a language used to query, transform, or create JSON text. A state machine's query language defaults to JSONPath. The interpreter MUST support [JSONPath](https://github.com/jayway/JsonPath 'JSONPath') and [JSONata](https://jsonata.org/ 'JSONata'), and MAY support others.

A state machine specifies its query language in the [top-level "QueryLanguage" field](#toplevelfields), which overrides the default and sets the query language for every state in the state machine. For example:

```
{
  "QueryLanguage": "JSONata",
  "StartAt": "Hello World",
  "States": {
    "Hello World": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
      "End": true
    }
  }
}

```

A state MAY have a "QueryLanguage" field to override the default. For example:

```
{
  "QueryLanguage": "JSONPath",
  "StartAt": "JSONPath state",
  "States": {
    "JSONPath state": {
      "Type": "Pass",
      "Parameters": {
        "total.$": "$.transaction.total"
      },
      "Next": "JSONata state"
    },
    "JSONata state": {
      "Type": "Pass",
      "QueryLanguage": "JSONata",
      "Output": {
        "total": "{% $states.input.transaction.total %}"
      },
      "End": true
    }
  }
}

```

The "JSONPath state" does not have a "QueryLanguage" field, so it defaults to "JSONPath" as specified in the top-level "QueryLanguage" field. This state contains a "Parameters" field which is specific to JSONPath, and which contains JSONPath features and syntax.

The "JSONata state" has its own "QueryLanguage" field set to "JSONata", so it overrides the state machine's query language. This state contains an "Output" field which is specific to JSONata, and which contains JSONata features and syntax.

If a Map or Parallel State has a "QueryLanguage" field, the default query language for each state inside the Map's "ItemProcessor" or the Parallel's "Branches" fields is the state machine's query language, and is independent of the Map or Parallel State's query language.

The interpreter MAY restrict specific combinations of the top-level "QueryLanguage" field and a state's "QueryLanguage" field.

This document describes the names, syntax, and semantics of fields specific to JSONPath or JSONata. See [JSONPath Concepts](#jsonpath-concepts) and [JSONata Concepts](#jsonata-concepts) for details.

### State Machine Variables

A state machine variable is a named JSON value. Instead of passing data between states, a state can store data in a variable and reference it in a later state.

Each variable name, whose length MUST BE less than or equal to 80 Unicode characters, MUST follow the rules for Unicode Identifiers as described in [Unicode Standard Annex #31](https://unicode.org/reports/tr31 'Unicode Standard Annex 31'). The first character of a variable name MUST be a Unicode ID_Start character, and the second and subsequent characters MUST be Unicode ID_Continue characters.

This document uses the term "state machine variable" to describe a variable assigned in a state using the ["Assign" field](#assigning-variables). Some query languages, such as JSONata, support variable assignment inside an expression, but a variable assigned inside an expression does not affect the value of any state machine variable. The only way a state can assign a value to a state machine variable is with the "Assign" field.

Any state except Succeed and Fail MAY assign a value to one or more state machine variables, and any state MAY reference the value of any variable that has a value on state entry. All references to a state machine variable in a state refer to the same value, which is the value it had at state entry, as described in the [Variable Scope section](#variable-scope).

This specification defines one reserved variable called "states" whose value depends on the query language. A state MUST NOT assign a value to "states".

In a JSONPath state, the "ResultPath" field MUST NOT reference a variable.

#### Assigning State Machine Variables

Any state except Succeed and Fail MAY have an "Assign" field at the state's top level. Any Choice Rule in a Choice State, and any Catcher in a Task, Map, or Parallel state, MAY have an "Assign" field. An "Assign" field can assign a value to one or more variables. The value of an "Assign" field MUST be a JSON object; it has no required fields. The name of each top-level field in the object names a variable to assign, and the field's value provides its new value.

For example:

```
"FirstState": {
  "Type": "Pass",
  "Assign": {
    "make": "Infiniti",
    "model": "G35",
    "year": 2006
  },
  "Next": "SecondState"
}

```

In this example, the state assigns `"Infiniti"` to the variable `make`, `"G35"` to `model`, and `2006` to `year`. Any state that executes after "FirstState" can reference these variables using a syntax that depends on the query language. For JSONPath and JSONata, variables are referenced by prepending the variable name with a "$", as in `$make`, `$model`, and `$year`. In this example, the state uses JSONata syntax to output a string that includes all three variable values.

```
"SecondState": {
  "Type": "Pass",
  "QueryLanguage": "JSONata",
  "Output": "{% $year & ' ' & $make & ' ' & $model %}",
  "Next": "ThirdState"
}

```

In this example, the output of "SecondState" would be `"2006 Infiniti G35"`.

Any variable referenced in an "Assign" field sees its current value as it was when the state was entered, and each variable's new value only takes effect in the next state. For example:

```
"Assigning": {
  "Type": "Pass",
  "QueryLanguage": "JSONata",
  "Assign": {
    "x": 42,
    "newOrOld": "{% $x %}"
  },
  "Next": "Referencing"
}

```

If variable `x` had the value `5` on state entry, the interpreter will assign `42` to `x`, and `5` to `newOrOld`. The JSONata string for `newOrOld` references `$x`, but the interpreter evaluates the expression using the current value of `x`, which is `5`. The new value of `x` (`42`) will only take effect in the next state.

#### Variable Scope

The interpreter places each variable into a state-machine-local scope, which this document simply refers to as a _scope_. A state-machine-local scope includes all states inside a "States" field, not including states inside Parallel or Map states in that scope. For example, the states inside a Map state's "States" field are in a separate, inner scope from the Map state's scope. A variable exists in a scope if any state in the scope assigns a value to it. A state MAY reference the value of any variable in its scope that has a value on state entry.

The interpreter maintains separate variable values for each scope, including for each Parallel branch and Map iteration. In a Parallel state, a state in one branch MUST NOT reference any variable assigned in another branch. In a Map state, a state in one iteration MUST NOT reference any variable assigned in another iteration.

The interpreter MAY allow states in inner scopes to reference variables from outer scopes. However, states in inner scopes MUST NOT assign to a variable with the same name as a variable in an outer scope. Put another way, the names of outer-scoped and inner-scoped variables MUST be unique. For example:

```
{
  "QueryLanguage": "JSONata",
  "StartAt": "Get Greeting",
  "States": {
    "Get Greeting": {
      "Type": "Pass",
      "Assign": {
        "outer": "hello"
      },
      "Next": "Greet Everyone"
    },
    "Greet Everyone": {
      "Type": "Map",
      "ItemProcessor": {
        "StartAt": "Begin",
        "States": {
          "Begin": {
            "Type": "Pass",
            "Assign": {
              "inner": "world",
              "hi": "{% $outer %}"
            },
            "Next": "End"
          },
          "End": {
            "Type": "Succeed",
            "Output": "{% $hi %}"
          }
        }
      },
      "Assign": {
        "outer": 2
      },
      "Next": "Goodbye"
    },
    "Goodbye": {
      "Type": "Succeed",
      "Output": "{% $outer %}"
    }
  }
}

```

In this example, variable `outer` is in the outer scope because it is assigned in a state inside the top-level "States" field, and variables `inner` and `hi` are in the inner scope because they are assigned in a state inside the inner "States" field. The "Get Greeting" and "Greet Everyone" states can both assign to `outer` because they are in the same outer scope. State "Begin" can reference `outer`, but since it is in the inner scope, it cannot assign it.

State "End" will output the string `hello`, and state "Goodbye" will output the number `2`.

When a Parallel branch or Map iteration completes, its variables go out of scope and are no longer accessible. Parallel branches and Map iterations can return results to the outer scope through the state output of one of its terminal states.

## JSONata Concepts

When a state's query language is JSONata, the interpreter supports fields and syntax for querying and transforming data using JSONata. For information about JSONPath, see [JSONPath Concepts](#jsonpath-concepts).

### Expressions

A JSONata expression can query, select, transform, and create JSON data.

In the States Language, JSONata expressions are written inside strings that start with `{%` and end with `%}`. The syntax of the text inside the `{%` and `%}` delimiters is that of [JSONata](https://jsonata.org/ 'JSONata'). In JSONata, any name that starts with "$" is a variable, so the value of `"{% $year %}"` is the current value of the `year` variable. This document refers to `{% %}`\-delimited JSONata expressions as JSONata strings. When the interpreter evaluates a JSONata string, the result is that of the JSONata expression inside the string.

JSONata has a built-in function library which JSONata expressions can call, for example `"{% $sum($order.total) %}"`. The interpreter MAY define other auxiliary JSONata functions and values, and MAY restrict the use of built-in functions.

JSONata expressions can define their own functions, as with the `$product` function in this calculation of 5 factorial:

```
"{% ($product := function($x, $y) {$x * $y}; $reduce([1..5], $product)) %}"`

```

A variable assigned inside a JSONata expression does not affect the value of any state machine variable. Put another way, the only way to assign a value to a state machine variable is with the "Assign" field.

### Reserved "states" Variable with JSONata

The States Language reserves one variable called "states". When the query language is JSONata, the "states" variable is defined as a JSON object containing fields defined by the interpreter as it executes each state. A state MUST NOT assign a value to "states".

The "states" variable is a JSON object containing these fields:

```
{
  "input":        // The state input
  "result":       // The state's result
  "errorOutput":  // The Error Output in a Catch
  "context":      // The Context Object
}

```

`$states.input` refers to the state input, and `$states.context` refers to the [Context Object](#context-object), both of which can be referenced in any field that accepts JSONata.

`$states.result` refers to the result that a Task, Map, or Parallel state returns, and can be referenced in the state's top-level "Output" and "Assign" fields.

`$states.errorOutput` refers to the [Error Output](#error-output) the interpreter generates when a Task, Map, or Parallel state reports an error, and can be referenced in a Catcher's "Output" and "Assign" fields.

For example:

```
"My Task": {
  "Type": "Task",
  "QueryLanguage": "JSONata",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:HelloWorld",
  "Output": {
    "customer": "{% $states.input.customer %}",
    "resultStatus": "{% $states.result.status %}",
    "elapsedTime": "{% $states.context.ElapsedTime %}"
  },
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "Output": {
        "errorDetails": "{% $states.errorOutput %}",
        "input": "{% $states.input %}"
      },
      "Next": "Handle Error"
    }
  ],
  "End": true
}

```

If the HelloWorld function succeeds, the state will output the JSON object specified by the state's top-level "Output" field, containing the value of the `customer` field from the state input, the `status` field from the result of executing the HelloWorld function, and the `ElapsedTime` field from the interpreter-defined Context Object.

If the HelloWorld function reports an error, the state will output the JSON object specified by the Catcher's "Output" field, which has an "errorDetails" field whose value is the Error Output, and an "input" field whose value is the state input. See [Error Handling](#error-handling) for details.

### Input and Output Processing with JSONata

As described earlier, data is passed between states as JSON texts. A state may need to control the format and content of the data it passes to the external code of a Task State or the branches of a Parallel State, or of the data it passes on as output. Fields named "Arguments" and "Output" exist to support this.

Any state except Fail MAY have "Output".

Task and Parallel States MAY have "Arguments".

#### Using Arguments and Output

In this discussion, "state input" means the JSON text that is the input to a state, "arguments" means the result of evaluating the "Arguments" field, "result" means the JSON text that a state generates, for example from external code invoked by a Task State, or the combined result of the branches in a Parallel or Map State, and "state output" means the final state output after processing the result with the "Output" field.

The interpreter dispatches data as input to tasks to do useful work, and receives output back from them. A common requirement is to reshape input data to meet the format expectations of tasks, and similarly to reshape the output coming back.

In the Task and Parallel States, the input to tasks is the value of the "Arguments" field, and the result can be reshaped with the "Output" field.

1.  The value of "Arguments" MUST be a JSON text, or a JSONata string that evaluates to a JSON text. If the "Arguments" field is provided, its result becomes the arguments to the external code invoked by a Task State, or the branches of a Parallel State. If not provided, the arguments are the state input. "Arguments" MAY reference `$states.input` and `$states.context`, but MUST NOT reference `$states.result` or `$states.errorOutput`.
2.  The value of "Output" MUST be a JSON text, or a JSONata string that evaluates to a JSON text. If the "Output" field is provided, its result becomes the state output, which serves as the state input for the next state. If not provided, the state output is the result in a Task, Map, and Parallel State, or the state input in all other states. In all states, "Output" MAY reference `$states.input` and `$states.context`. In Task, Map, and Parallel States, the state's top-level "Output" field MAY reference `$states.result`, and the Catcher's "Output" field MAY reference `$states.errorOutput`.

#### Using Assign

The value of an "Assign" field MUST be a JSON object; it has no required fields. The name of each top-level field in the object names a variable to assign, and the field's value provides its new value.

If an "Assign" field is provided, the interpreter first evaluates the new value for each variable, and then performs the assignments. Any variable referenced in an "Assign" field sees its current value as it was when the state was entered, and each variable's new value only takes effect in the next state.

In all states, "Assign" MAY reference `$states.input` and `$states.context`. In Task, Map, and Parallel States, the state's top-level "Assign" field MAY reference `$states.result`, and the Catcher's "Assign" field MAY reference `$states.errorOutput`.

### JSONata Evaluation

In any field that accepts JSONata, if its value, or any value nested inside a JSON object or array, is a JSONata string, the interpreter evaluates the JSONata expression and then replaces it with the result.

For example, suppose a state assigns these variables:

```
"GetSampleData": {
  "Type": "Pass",
  "Assign": {
    "student": {
      "name": "Scotland",
      "course": [
        { "grade": 34 },
        { "grade": 99 },
        { "grade": 76 },
        { "grade": 96 }
      ]
    },
    "class": {
      "teacher": "Bert"
    },
    "two": "the number 2"
  },
  "Next": "A Task"
}

```

And the next state references the variables in its "Arguments" and "Output" fields:

```
"A Task": {
  "Type": "Task",
  "QueryLanguage": "JSONata",
  "Resource": "arn:aws:lambda:us-east-1:123456789012:function:DoTheTask",
  "Arguments": {
    "student": "{% $student.name %}",
    "classInfo": {
      "teacher": "{% $class.teacher %}"
    },
    "values": [ 1, "{% $two %}", "three" ]
  },
  "Output": "{% { 'avg': $average($student.course.grade), 'num': $count($student.course) }  %}",
  "Next": "Process the result"
}

```

In this case, the "Arguments" field specifies a JSON object that contains JSONata strings for some of its fields and array items, and the "Output" field specifies a single JSONata string to create the entire value. In other words, JSONata can be used to calculate the entire value of a field, or individual parts of it.

The interpreter will first evaluate the JSONata expressions inside the "Arguments" object including field values and array items, and send the resulting object to the DoTheTask function:

```
{
  "student": "Scotland",
  "classInfo": {
    "teacher": "Bert"
  },
  "values": [ 1, "the number 2", "three" ]
}

```

After DoTheTask returns, the interpreter will evaluate the "Output" field and return this JSON object:

```
{
  "avg": 76.25,
  "num": 4
}

```

### JSONata Runtime Errors

A JSONata expression can fail for different reasons. For example:

A JSONata expression may cause a type error, for example `"{% $x + $y %}"` if `$x` or `$y` is not a number.

A JSONata expression may evaluate to a type the field will not accept, for example `"TimeoutSeconds": "{% $name %}"` in a Task State if `$name` is a string, because TimeoutSeconds requires a number.

A JSONata expression may evaluate to a value the field will not accept, for example `"ToleratedFailurePercentage": "{% $negative %}"` if `$negative` evaluates to a negative number, because ToleratedFailurePercentage requires a number between zero and 100.

A JSONata expression may fail to return a result, for example `"{% $data.thisFieldDoesNotExist %}"`, which is an error because JSON cannot represent an undefined value.

In each case, the interpreter will throw "States.QueryEvaluationError". Task, Map, and Parallel states MAY use a Retrier to retry on the error, and a Catcher to catch the error. See [Error Handling](#error-handling) for details.

### JSONata Restrictions

The States Language places some restrictions on JSONata expressions.

Unrestricted JSONata expressions can reference an implicitly-supplied "input document" using unqualified field names and two built-in variables called "$" and "$$". The States Language does not implicitly provide an input document, so JSONata expressions cannot use "$", "$$", or unqualified field names to reference it. Instead, a JSONata expression MUST reference data through state machine variables.

The variable "$" or an unqualified field name at the top level of a JSONata expression, for example `$`, `$.total`, or `total`, refers to the input document, but "$" or an unqualified field name nested inside an expression, for example `$order[$.total > 10]` or `$order[total > 10]`, refers to the contextual value at that point in the evaluation. In the States Language, a JSONata expression MUST NOT reference "$" or unqualified field names at the top level, but MAY reference "$" or unqualified field names nested inside an expression.

Since the variable "$$" always refers to the entire input document, a JSONata expression MUST NOT reference "$$".

## JSONPath Concepts

When a state sets the query language to JSONPath, the interpreter supports fields and syntax for querying data using JSONPath paths. For information about JSONata, see [JSONata Concepts](#jsonata-concepts).

### Paths

A Path is a string, beginning with "$", used to identify components within a JSON text. The syntax is that of [JSONPath](https://github.com/jayway/JsonPath 'JSONPath').

When a Path begins with "$$", two dollar signs, this signals that it is intended to identify content within the Context Object. The first dollar sign is stripped, and the remaining text, which begins with a dollar sign, is interpreted as the JSONPath applying to the Context Object.

### Reference Paths

A Reference Path is a Path with syntax limited in such a way that it can only identify a single node in a JSON structure: the operators "@", ",", ":", and "?" are not supported - all Reference Paths MUST be unambiguous references to a single value, array, or object (subtree).

For example, if state input data contained the values:

```
{
  "foo": 123,
  "bar": ["a", "b", "c"],
  "car": {
      "cdr": true
  }
}

```

Then the following Reference Paths would return:

```
$.foo => 123
$.bar => ["a", "b", "c"]
$.car.cdr => true

```

Paths and Reference Paths are used by certain states, as specified later in this document, to control the flow of a state machine or to configure a state's settings or options.

Here are some examples of acceptable Reference Path syntax:

```
$.store.book
$.store\.book
$.\stor\e.boo\k
$.store.book.title
$.foo.\.bar
$.foo\@bar.baz\[\[.\?pretty
$.&Ж中.\uD800\uDF46
$.ledgers.branch[0].pending.count
$.ledgers.branch[0]
$.ledgers[0][22][315].foo
$['store']['book']
$['store'][0]['book']

```

### Payload Template

The interpreter dispatches data as input to tasks to do useful work, and receives output back from them. A common requirement is to reshape input data to meet the format expectations of tasks, and similarly to reshape the output coming back. A JSON object structure called a Payload Template is provided for this purpose.

In the Task, Map, Parallel, and Pass States, the Payload Template is the value of a field named "Parameters". In the Task, Map, and Parallel States, there is another Payload Template which is the value of a field named "ResultSelector".

A Payload Template MUST be a JSON object; it has no required fields. The interpreter processes the Payload Template as described in this section; the result of that processing is called the payload.

To illustrate by example, the Task State has a field named "Parameters" whose value is a Payload Template. Consider the following Task State:

```
"X": {
  "Type": "Task",
  "Resource": "arn:aws:states:us-east-1:123456789012:task:X",
  "Next": "Y",
  "Parameters": {
    "first": 88,
    "second": 99
  }
}

```

In this case, the payload is the object with "first" and "second" fields whose values are respectively 88 and 99. No processing needs to be performed and the payload is identical to the Payload Template.

Values from the Payload Template’s input and the Context Object can be inserted into the payload with a combination of a field-naming convention, Paths and Intrinsic Functions.

If any field within the Payload Template (however deeply nested) has a name ending with the characters ".$", its value is transformed according to the following rules and the field is renamed to strip the ".$" suffix.

If the field value begins with only one "$", the value MUST be a Path. In this case, the Path is applied to the Payload Template’s input and is the new field value.

If the field value begins with "$$", the first dollar sign is stripped and the remainder MUST be a Path. In this case, the Path is applied to the Context Object and is the new field value.

If the field value does not begin with "$", it MUST be an Intrinsic Function ([see Intrinsic Functions](#intrinsic-functions)). The interpreter invokes the Intrinsic Function and the result is the new field value.

If the path is legal but cannot be applied successfully, the interpreter fails the machine execution with an Error Name of "States.ParameterPathFailure". If the Intrinsic Function fails during evaluation, the interpreter fails the machine execution with an Error Name of "States.IntrinsicFailure".

A JSON object MUST NOT have duplicate field names after fields ending with the characters ".$" are renamed to strip the ".$" suffix.

```
"X": {
  "Type": "Task",
  "Resource": "arn:aws:states:us-east-1:123456789012:task:X",
  "Next": "Y",
  "Parameters": {
    "flagged": true,
    "parts": {
      "first.$": "$.vals[0]",
      "last3.$": "$.vals[-3:]"
    },
    "weekday.$": "$.DayOfWeek",
    "formattedOutput.$": "States.Format('Today is {}', $.DayOfWeek)"
  }
}

```

Suppose that the input to the P is as follows:

```
{
  "flagged": 7,
  "vals": [0, 10, 20, 30, 40, 50]
}

```

Further, suppose that the Context Object is as follows:

```
{
  "DayOfWeek": "TUESDAY"
}

```

In this case, the effective input to the code identified in the "Resource" field would be as follows:

```
{
  "flagged": true,
  "parts": {
    "first": 0,
    "last3": [30, 40, 50]
  },
  "weekday": "TUESDAY",
  "formattedOutput": "Today is TUESDAY"
}

```

### Intrinsic Functions

The States Language provides a small number of "Intrinsic Functions", constructs which look like functions in programming languages and can be used to help Payload Templates process the data going to and from Task Resources. See [Appendix B](#appendix-b) for a full list of Intrinsic Functions

Here is an example of an Intrinsic Function named "States.Format" being used to prepare data:

```
"X": {
  "Type": "Task",
  "Resource": "arn:aws:states:us-east-1:123456789012:task:X",
  "Next": "Y",
  "Parameters": {
    "greeting.$": "States.Format('Welcome to {} {}\\'s playlist.', $.firstName, $.lastName)"
  }
}

```

1.  An Intrinsic Function MUST be a string.
2.  The Intrinsic Function MUST begin with an Intrinsic Function name. An Intrinsic Function name MUST contain only the characters A through Z, a through z, 0 through 9, ".", and "\_".

    All Intrinsic Functions defined by this specification have names that begin with "States.". The interpreter MAY define its own Intrinsic Functions whose names MUST NOT begin with "States.".

3.  The Intrinsic Function name MUST be followed immediately by a list of zero or more arguments, enclosed by "(" and ")", and separated by commas.
4.  Intrinsic Function arguments may be strings enclosed by apostrophe (`'`) characters, numbers, null, Paths, or nested Intrinsic Functions.
5.  The value of a string, number or null argument is the argument itself. The value of an argument which is a Path is the result of applying it to the input of the Payload Template. The value of an argument which is an Intrinsic Function is the result of the function invocation."

    Note that in the previous example, the first argument of `States.Format` could have been a Path that yielded the formatting template string.

6.  The following characters are reserved for all Intrinsic Functions and MUST be escaped: ' { } \\

    If any of the reserved characters needs to appear as part of the value without serving as a reserved character, it MUST be escaped with a backslash.

    If the character "\\ needs to appear as part of the value without serving as an escape character, it MUST be escaped with a backslash.

    The literal string `\'` represents `'`.  
    The literal string `\{` represents `{`.  
    The literal string `\}` represents `}`.  
    The literal string `\\` represents `\`.

    In JSON, all backslashes contained in a string literal value must be escaped with another backslash, therefore, the preceding sequences will equate to:

    The escaped string `\\'` represents `'`.  
    The escaped string `\\{` represents `{`.  
    The escaped string `\\}` represents `}`.  
    The escaped string `\\\\` represents `\`.

    If an open escape backslash `\` is found in the Intrinsic Function, the interpreter will throw a runtime error.

### Reserved "states" Variable with JSONPath

The States Language reserves one variable called "states". When the query language is JSONPath, its value is defined by the interpreter. This version of the States Language specification does not specify any contents of the "states" variable when the query language is JSONPath. A state MUST NOT assign a value to "states".

### Input and Output Processing with JSONPath

As described earlier, data is passed between states as JSON texts. However, a state may need to process only a subset of its input data, may need to include a portion of one or more variable values, and may need that data structured differently from the way it appears in the input or variables. Similarly, it may need to control the format and content of the data that it passes on as output or that it assigns to variables.

Fields named "InputPath", "Parameters", "ResultSelector", "ResultPath", and "OutputPath" exist to support this.

Any state except for Succeed and Fail MAY have "InputPath" and "OutputPath".

States which potentially generate results MAY have "Parameters", "ResultSelector" and "ResultPath": Task State, Parallel State, and Map State.

Pass State MAY have "Parameters" and "ResultPath" to control its output value.

#### Using InputPath, Parameters, ResultSelector, ResultPath and OutputPath

In this discussion, "raw input" means the JSON text that is the input to a state. "Result" means the JSON text that a state generates, for example from external code invoked by a Task State, the combined result of the branches in a Parallel or Map State, or the Value of the "Result" field in a Pass State. "Effective input" means the input after the application of InputPath and Parameters, "effective result" means the result after processing it with ResultSelector and "effective output" means the final state output after processing the result with ResultSelector, ResultPath and OutputPath.

1.  The value of "InputPath" MUST be a Path, which is applied to a State’s raw input to select some or all of it; that selection is used by the state, for example in passing to Resources in Task States and Choices selectors in Choice States.
2.  The value of "Parameters" MUST be a Payload Template which is a JSON object, whose input is the result of applying the InputPath to the raw input. If the "Parameters" field is provided, its payload, after the extraction and embedding, becomes the effective input.
3.  The value of "ResultSelector" MUST be a Payload Template, whose input is the result, and whose payload replaces and becomes the effective result.
4.  The value of "ResultPath" MUST be a Reference Path, which specifies the raw input’s combination with or replacement by the state’s result.

    The value of "ResultPath" MUST NOT begin with "$$"; i.e. it may not be used to insert content into the Context Object.

5.  The value of "OutputPath" MUST be a Path, which is applied to the state’s output after the application of ResultPath, producing the effective output which serves as the raw input for the next state.

Note that JSONPath can yield multiple values when applied to an input JSON text. For example, given the text:

Then if the JSONPath `$.a[0,1]` is applied, the result will be two JSON texts, `1` and `2`. When this happens, to produce the effective input, the interpreter gathers the texts into an array, so in this example the state would see the input:

The same rule applies to OutputPath processing; if the OutputPath result contains multiple values, the effective output is a JSON array containing all of them.

The "ResultPath" field’s value is a Reference Path that specifies where to place the result, relative to the raw input. If the raw input has a field at the location addressed by the ResultPath value then in the output that field is discarded and overwritten by the state's result. Otherwise, a new field is created in the state output, with intervening fields constructed as necessary. For example, given the raw input:

```
{
  "master": {
    "detail": [1, 2, 3]
  }
}

```

If the state's result is the number `6`, and the "ResultPath" is `$.master.detail`, then in the output the `detail` field would be overwritten:

```
{
  "master": {
    "detail": 6
  }
}

```

If instead a "ResultPath" of `$.master.result.sum` was used then the result would be combined with the raw input, producing a chain of new fields containing `result` and `sum`:

```
{
  "master": {
    "detail": [1, 2, 3],
    "result": {
      "sum": 6
    }
  }
}

```

If the value of InputPath is `null`, that means that the raw input is discarded, and the effective input for the state is an empty JSON object, `{}`. Note that having a value of `null` is different from the "InputPath" field being absent.

If the value of ResultPath is `null`, that means that the state’s result is discarded and its raw input becomes its result.

If the value of OutputPath is `null`, that means the input and result are discarded, and the effective output from the state is an empty JSON object, `{}`.

#### Using Assign

The value of "$" in "Assign" depends on the state type. In Task, Map, and Parallel States, "$" refers to the result in a state's top-level "Assign", and to the Error Output in a Catcher's "Assign". In Choice and Wait States, "$" refers to the effective input, which is the value after "InputPath" has been applied to the state input. For Pass State, "$" refers to the result, whether generated by the "Result" field or the "InputPath" and "Parameters" fields.

#### Defaults

Each of InputPath, Parameters, ResultSelector, ResultPath, and OutputPath are optional. The default value of InputPath is "$", so by default the effective input is just the raw input. The default value of ResultPath is "$", so by default a state’s result overwrites and replaces the input. The default value of OutputPath is "$", so by default a state’s effective output is the result of processing ResultPath.

Parameters and ResultSelector have no default value. If absent, they have no effect on their input.

Therefore, if none of InputPath, Parameters, ResultSelector, ResultPath, or OutputPath are supplied, a state consumes the raw input as provided and passes its result to the next state.

#### Input/Output Processing Examples

Consider the previous example of a Lambda task that sums a pair of numbers. As presented, its input is: `{ "val1": 3, "val2": 4 }` and its output is: `7`.

Suppose the input is little more complex:

```
{
  "title": "Numbers to add",
  "numbers": { "val1": 3, "val2": 4 }
}

```

Then suppose we modify the state definition by adding:

```
"InputPath": "$.numbers",
"ResultPath": "$.sum"

```

And finally, suppose we simplify Line 4 of the Lambda function to read as follows: `return JSON.stringify(total)`. This is probably a better form of the function, which should really only care about doing math and not care how its result is labeled.

In this case, the output would be:

```
{
  "title": "Numbers to add",
  "numbers": { "val1": 3, "val2": 4 },
  "sum": 7
}

```

The interpreter might need to construct multiple levels of JSON object to achieve the desired effect. Suppose the input to some Task State is:

Suppose the output from the Task is "Hi!", and the value of the "ResultPath" field is "$.b.greeting". Then the output from the state would be:

```
{
  "a": 1,
  "b": {
    "greeting": "Hi!"
  }
}

```

#### JSONPath Runtime Errors

Suppose a state’s input is the string `"foo"`, and its "ResultPath" field has the value "$.x". Then ResultPath cannot apply and the interpreter fails the machine with an Error Name of "States.ResultPathMatchFailure".

## Error Handling

### Errors

Any state can encounter runtime errors. Errors can arise because of state machine definition issues (e.g. JSONata evaluation errors discussed in the [JSONata Runtime Errors section](#jsonata-runtime-errors), or the errors discussed in the [JSONPath Runtime Errors section](#jsonpath-runtime-errors)), task failures (e.g. an exception thrown by a Lambda function) or because of transient issues, such as network partition events.

When a state reports an error, the default course of action for the interpreter is to fail the whole state machine.

#### Error representation

Errors are identified by case-sensitive strings, called Error Names. The States Language defines a set of built-in strings naming well-known errors, all of which begin with the prefix "States."; see [Appendix A](#appendix-a).

States MAY report errors with other names, which MUST NOT begin with the prefix "States.".

### Retrying after error

Task States, Parallel States, and Map States MAY have a field named "Retry", whose value MUST be an array of objects, called Retriers.

Each Retrier MUST contain a field named "ErrorEquals" whose value MUST be a non-empty array of Strings, which match [Error Names](#error-names).

When a state reports an error, the interpreter scans through the Retriers and, when the Error Name appears in the value of a Retrier’s "ErrorEquals" field, implements the retry policy described in that Retrier.

An individual Retrier represents a certain number of retries, usually at increasing time intervals.

A Retrier MAY contain a field named "IntervalSeconds", whose value MUST be a positive integer, representing the number of seconds before the first retry attempt (default value: 1); a field named "MaxAttempts" whose value MUST be a non-negative integer, representing the maximum number of retry attempts (default: 3); a field named "MaxDelaySeconds" whose value MUST be positive integer, representing the maximum interval in seconds to wait before the next retry attempt; a field named "JitterStrategy", whose value MUST be a string, representing the jitter strategy to use in the retry interval calculation; and a field named "BackoffRate", a number which is the multiplier that increases the retry interval on each attempt (default: 2.0). The value of BackoffRate MUST be greater than or equal to 1.0.

Note that a "MaxAttempts" field whose value is 0 is legal, specifying that some error or errors should never be retried.

The States Language does not constrain the value of the "JitterStrategy" field. The interpreter will use the specified value to select the jitter strategy to use when calculating the retry interval.

Here is an example of a Retrier which will make 2 retry attempts after waits of 3 and 6 seconds:

```
"Retry" : [
  {
    "ErrorEquals": [ "States.Timeout" ],
    "IntervalSeconds": 3,
    "MaxAttempts": 2,
    "BackoffRate": 2.0
  }
]

```

Here is the same example, but with a maximum limit of 4 seconds on the retry interval. In this case the Retrier will make the second attempt after 4 seconds, rather than 6 seconds:

```
"Retry" : [
  {
    "ErrorEquals": [ "States.Timeout" ],
    "IntervalSeconds": 3,
    "MaxAttempts": 2,
    "BackoffRate": 2.0,
    "MaxDelaySeconds": 4
  }
]

```

Here is an example of a Retrier which uses an interpreter-defined JitterStrategy called "SAMPLE". Instead of waiting for 2 seconds before the first retry attempt or 4 seconds before the second retry attempt, the interpreter will modify these values according to the jitter strategy:

```
"Retry" : [
  {
    "ErrorEquals": [ "States.Timeout" ],
    "IntervalSeconds": 2,
    "MaxAttempts": 2,
    "BackoffRate": 2.0,
    "JitterStrategy": "SAMPLE"
  }
]

```

The reserved name "States.ALL" in a Retrier’s "ErrorEquals" field is a wildcard and matches any Error Name. Such a value MUST appear alone in the "ErrorEquals" array and MUST appear in the last Retrier in the "Retry" array.

Here is an example of a Retrier which will retry any error except for "States.Timeout", using the default retry parameters.

```
"Retry" : [
  {
    "ErrorEquals": [ "States.Timeout" ],
    "MaxAttempts": 0
  },
  {
    "ErrorEquals": [ "States.ALL" ]
  }
]

```

If the error recurs more times than allowed for by the "MaxAttempts" field, retries cease and normal error handling resumes.

#### Complex retry scenarios

A Retrier’s parameters apply across all visits to that Retrier in the context of a single state execution. This is best illustrated by example; consider the following Task State:

```
"X": {
  "Type": "Task",
  "Resource": "arn:aws:states:us-east-1:123456789012:task:X",
  "Next": "Y",
  "Retry": [
    {
      "ErrorEquals": [ "ErrorA", "ErrorB" ],
      "IntervalSeconds": 1,
      "BackoffRate": 2,
      "MaxAttempts": 2
    },
    {
      "ErrorEquals": [ "ErrorC" ],
      "IntervalSeconds": 5
    }
  ],
  "Catch": [
    {
      "ErrorEquals": [ "States.ALL" ],
      "Next": "Z"
    }
  ]
}

```

Suppose that this task fails four successive times, throwing Error Names "ErrorA", "ErrorB", "ErrorC", and "ErrorB". The first two errors match the first retrier and cause waits of one and two seconds. The third error matches the second retrier and causes a wait of five seconds. The fourth error would match the first retrier but its "MaxAttempts" ceiling of two retries has already been reached, so that Retrier fails, and execution is redirected to the "Z" state via the "Catch" field.

Note that once the interpreter transitions to another state in any way, all the Retrier parameters reset.

### Fallback states

Task States, Parallel States, and Map States MAY have a field named "Catch", whose value MUST be an array of objects, called Catchers.

Each Catcher MUST contain a field named "ErrorEquals", specified exactly as with the Retrier "ErrorEquals" field, and a field named "Next" whose value MUST be a string exactly matching a State Name.

When a state reports an error and either there is no Retrier, or retries have failed to resolve the error, the interpreter scans through the Catchers in array order, and when the [Error Name](#error-names) appears in the value of a Catcher’s "ErrorEquals" field, transitions the machine to the state named in the value of the "Next" field.

The reserved name "States.ALL" appearing in a Catcher’s "ErrorEquals" field is a wildcard and matches any Error Name. Such a value MUST appear alone in the "ErrorEquals" array and MUST appear in the last Catcher in the "Catch" array.

Each Catcher can list multiple errors to handle.

When a state has both "Retry" and "Catch" fields, the interpreter uses any appropriate Retriers first and only applies the matching Catcher transition if the retry policy fails to resolve the error.

#### Error output

When a state reports an error and it matches a Catcher, causing a transfer to another state, the state’s result is a JSON object, called the Error Output. The Error Output MUST have a string-valued field named "Error", containing the Error Name. It SHOULD have a string-valued field named "Cause", containing human-readable text about the error.

A Catcher MAY have an "Assign" field, which works exactly like [a state's top-level "Assign"](#assigning-variables), and may be used to assign values to one or more variables. If a state reports an error, the interpreter evaluates the matching Catcher's "Assign" field, if any, and does not evaluate the state's top-level "Assign" field.

#### JSONata Catchers

In JSONata States, a Catcher MAY have an "Output" field, which works exactly like [a state's top-level "Output"](#arguments-and-output), and may be used to provide the state output, which will become the input for the Catcher's "Next" state. If the "Output" field is not provided, the state output is the Error Output.

In JSONata States, a Catcher's "Assign" and "Output" fields MAY reference the `$states.input`, `$states.errorOutput`, and `$states.context` fields.

Here is an example of a Catcher that will transition to the state named "RecoveryState" when a Lambda function throws an unhandled Java Exception, and otherwise to the "EndMachine" state, which is presumably Terminal.

If the first Catcher matches the Error Name, the input to "RecoveryState" will be the original state input, with the Error Output as the value of the top-level "error-info" field. For any other error, the variable `isCritical` will be assigned the value of a JSONata expression, and the input to "EndMachine" will just be the Error Output.

```
"Catch": [
  {
    "ErrorEquals": [ "java.lang.Exception" ],
    "Output": "{% $merge([ $states.input, {'error-info': $states.errorOutput} ]) %}",
    "Next": "RecoveryState"
  },
  {
    "ErrorEquals": [ "States.ALL" ],
    "Assign": {
      "isCritical": "{% $contains($lowercase($states.errorOutput.Error), /.*fatal.*/)  %}"
    },
    "Next": "EndMachine"
  }
]

```

#### JSONPath Catchers

In JSONPath States, a Catcher MAY have a "ResultPath" field, which works exactly like [a state’s top-level "ResultPath"](#filters), and may be used to inject the Error Output into the state’s original input to create the input for the Catcher’s "Next" state. The default value, if the "ResultPath" field is not provided, is "$", meaning that the output consists entirely of the Error Output.

Here is an example of a Catcher that will transition to the state named "RecoveryState" when a Lambda function throws an unhandled Java Exception, and otherwise to the "EndMachine" state, which is presumably Terminal.

If the first Catcher matches the Error Name, the input to "RecoveryState" will be the original state input, with the Error Output as the value of the top-level "error-info" field. For any other error, the variable `hasError` will be assigned `true`, and the input to "EndMachine" will just be the Error Output.

```
"Catch": [
  {
    "ErrorEquals": [ "java.lang.Exception" ],
    "ResultPath": "$.error-info",
    "Next": "RecoveryState"
  },
  {
    "ErrorEquals": [ "States.ALL" ],
    "Assign": {
      "hasError": true
    },
    "Next": "EndMachine"
  }
]

```

## State Types

As a reminder, the state type is given by the value of the "Type" field, which MUST appear in every State object.

Many fields can appear in more than one state type. The following tables summarize which common fields can appear in which states for JSONata States and JSONPath States. It excludes fields that are specific to one state type.

### Table of State Types and Fields (JSONata)

|                            | States   |          |          |          |          |          |          |          |
| -------------------------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- |
|                            | Task     | Parallel | Map      | Pass     | Wait     | Choice   | Succeed  | Fail     |
| Type                       | Required | Required | Required | Required | Required | Required | Required | Required |
| Comment                    | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |
| Output                     | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |          |
| Assign                     | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |          |          |
| One of: Next or "End":true | Required | Required | Required | Required | Required |          |          |          |
| Arguments                  | Allowed  | Allowed  |          |          |          |          |          |          |
| Retry, Catch               | Allowed  | Allowed  | Allowed  |          |          |          |          |          |

### Table of State Types and Fields (JSONPath)

|                            | States   |          |          |          |          |          |          |          |
| -------------------------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- | -------- |
|                            | Task     | Parallel | Map      | Pass     | Wait     | Choice   | Succeed  | Fail     |
| Type                       | Required | Required | Required | Required | Required | Required | Required | Required |
| Comment                    | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |
| InputPath, OutputPath      | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |          |
| Assign                     | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  | Allowed  |          |          |
| One of: Next or "End":true | Required | Required | Required | Required | Required |          |          |          |
| ResultPath                 | Allowed  | Allowed  | Allowed  | Allowed  |          |          |          |          |
| Parameters                 | Allowed  | Allowed  | Allowed  | Allowed  |          |          |          |          |
| ResultSelector             | Allowed  | Allowed  | Allowed  |          |          |          |          |          |
| Retry, Catch               | Allowed  | Allowed  | Allowed  |          |          |          |          |          |

### Pass State

The Pass State (identified by `"Type":"Pass"`) by default passes its input to its output, performing no work.

A Pass State MAY have an "Assign" field to assign variables.

#### JSONata Pass State

A JSONata Pass State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the Pass State copies its input through to its output.

Here is an example of a Pass State that provides some fixed data in a variable.

```
"ProvideTestData": {
  "Type": "Pass",
  "QueryLanguage": "JSONata",
  "Assign": {
    "coords": {
      "x-datum": 0.381018,
      "y-datum": 622.2269926397355,
      "additional": "{% $exists($states.input.moreData) ? $states.input.moreData : {} %}"
    }
  },
  "Next": "End"
}

```

#### JSONPath Pass State

A Pass State MAY have a field named "Result". If present, its value is treated as the output of a virtual task, and placed as prescribed by the "ResultPath" field, if any, to be passed on to the next state. If "Result" is not provided, the output is the input. Thus, if neither "Result" nor "ResultPath" are provided, the Pass State copies its input through to its output.

Here is an example of a Pass State that injects some fixed data into the state machine.

```
"ProvideTestData": {
  "Type": "Pass",
  "Result": {
    "x-datum": 0.381018,
    "y-datum": 622.2269926397355
  },
  "ResultPath": "$.coords",
  "Next": "End"
}

```

Suppose the input to this state were as follows:

Then the output would be:

```
{
  "georefOf": "Home",
  "coords": {
    "x-datum": 0.381018,
    "y-datum": 622.2269926397355
  }
}

```

### Task State

The Task State (identified by `"Type":"Task"`) causes the interpreter to execute the work identified by the state’s "Resource" field.

Here is an example:

```
"TaskState": {
  "Comment": "Task State example",
  "Type": "Task",
  "Resource": "arn:aws:states:us-east-1:123456789012:task:HelloWorld",
  "Next": "NextState",
  "TimeoutSeconds": 300,
  "HeartbeatSeconds": 60
}

```

A Task State MUST include a "Resource" field, whose value MUST be a URI that uniquely identifies the specific task to execute. The States language does not constrain the URI scheme nor any other part of the URI.

A JSONata Task State MAY have an "Arguments" field which, if present, provides the input to the task it will execute. If "Arguments" is not provided, the state input is passed as the input to the task.

A JSONata Task State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the Task State copies its input through to its output.

A JSONPath Task State MAY have an "InputPath" field, whose value MUST be a path, to filter the state input, and MAY have a "Parameters" field, whose value MUST be a Payload Template which is used to generate the effective input for the task in the usual way.

A JSONPath Task State MAY have a "ResultSelector" field, whose value MUST be a Payload Template which is used to generate the effective result, MAY have a "ResultPath" field which is used to insert the effective result into the input data, and MAY have an "OutputPath" field, whose value MUST be a path which is used to create the state output in the usual way.

A Task State MAY have an "Assign" field to assign variables.

#### Timeouts

Tasks can optionally specify timeouts. Timeouts (the "TimeoutSeconds" and "HeartbeatSeconds" fields) are specified in seconds and MUST be positive integers.

Both the total and heartbeat timeouts can be provided indirectly.

A JSONata Task State MAY specify JSONata strings for the "TimeoutSeconds" and "HeartbeatSeconds" fields whose values, when evaluated, MUST be positive integers.

A JSONPath Task State MAY have "TimeoutSecondsPath" and "HeartbeatSecondsPath" fields which MUST be Reference Paths; when resolved, they MUST select fields whose values are positive integers. A Task State MUST NOT include both "TimeoutSeconds" and "TimeoutSecondsPath" or both "HeartbeatSeconds" and "HeartbeatSecondsPath".

If provided, the "HeartbeatSeconds" interval MUST be smaller than the "TimeoutSeconds" value.

If not provided, the default value of "TimeoutSeconds" is 60.

If the state executes longer than the specified timeout, or if more time than the specified heartbeat elapses between heartbeats from the task, then the interpreter fails the state with a `States.Timeout` Error Name.

#### Credentials

A Task State MAY include a "Credentials" field, whose value MUST be a JSON object whose value is defined by the interpreter. The States language does not constrain the value of the "Credentials" field. The interpreter will use the specified credentials to execute the work identified by the state's "Resource" field.

### Choice State

A Choice State (identified by `"Type":"Choice"`) adds branching logic to a state machine.

A Choice State MUST have a "Choices" field whose value is a non-empty array. Each element of the array MUST be a JSON object and is called a Choice Rule. A Choice Rule may be evaluated to return a boolean value. A Choice Rule at the top level, i.e. which is a member of the "Choices" array, MUST have a "Next" field, whose value MUST match a state name.

Each Choice Rule MAY have an "Assign" field, which works exactly like [a state's top-level "Assign"](#assigning-variables), and may be used to assign values to one or more variables. If a Choice Rule is chosen, the interpreter evaluates the Choice Rule's "Assign" field, if any, and does not evaluate the state's top-level "Assign" field.

If no Choice Rules match, the interpreter evaluates the states's top-level "Assign" field, if any.

Choice Rule comparison fields differ depending on the state's query language.

#### JSONata Choice Rules

In a JSONata Choice State, each Choice Rule MUST have a "Condition" field. The "Condition" field accepts a boolean value or a JSONata string that must evaluate to a boolean value.

The interpreter scans the Choice Rules in order and chooses the first Choice Rule whose "Condition" field evaluates to `true`. It evaluates the chosen Choice Rule's "Assign" and "Output" fields, if any, and then transitions to the state specified in the "Next" field.

Each Choice Rule MAY have an "Output" field, which works exactly like [a state's top-level "Output"](#arguments-and-output). If a Choice Rule is chosen, the value of its "Output" field, if any, will become the state output, which will become the input for the Choice Rule's "Next" state. If an "Output" field is not provided, the state input is passed through to its output.

If no Choice Rule is chosen, the value of the state's top-level "Output" field, if any, will become the state output, which will become the input for the next state as specified by the Choice State's "Default" field. If an "Output" field is not provided, the state input is passed through to its output.

The "Output" and "Assign" fields MAY reference the `$states.input` and `$states.context` fields.

For example:

```
"DispatchEvent": {
  "Type" : "Choice",
  "QueryLanguage": "JSONata",
  "Choices": [
    {
      "Condition": "{% $states.input.type != 'Private' %}",
      "Next": "Public"
    },
    {
      "Condition": "{% $exists($value) and $type($value)='number' and $value>=20 and $value<30 %}",
      "Assign": {
        "range": "twenties"
      },
      "Next": "ValueInTwenties"
    },
    {
      "Condition": "{% $states.input.rating >= $states.input.auditThreshold %}",
      "Output": {
        "excess": "{% $states.input.rating - $states.input.auditThreshold %}"
      },
      "Next": "StartAudit"
    }
  ],
  "Default": "RecordEvent",
  "Assign": {
    "range": "default"
  }
}

```

If `$states.input.type` = `"Private"`, and `$value` is `23`, then the second Choice Rule matches, the `range` variable will be assigned the string `"twenties"`, and the state input will be passed through to its output before transitioning to the "ValueInTwenties" state.

If the third Choice Rule matches, then the state output will be assigned a JSON object with its `"excess"` field set to the difference between the `rating` and `auditThreshold` fields in the state input, and no variables will be assigned, before transitioning to the "StartAudit" state.

If no Choice Rules match, the `range` variable will be assigned the string `"default"`, and the state input will be passed through to its output before transitioning to the "RecordEvent" state.

#### JSONPath Choice Rules

The interpreter attempts pattern-matches against the top-level Choice Rules in order and transitions to the state specified in the "Next" field on the first Choice Rule where there is an exact match between the input value and a member of the comparison-operator array.

Here is an equivalent example of a JSONPath Choice State.

```
"DispatchEvent": {
  "Type" : "Choice",
  "Choices": [
    {
      "Not": {
        "Variable": "$.type",
        "StringEquals": "Private"
      },
      "Next": "Public"
    },
    {
      "And": [
        {
          "Variable": "$.value",
          "IsPresent": true
        },
        {
          "Variable": "$.value",
          "IsNumeric": true
        },
        {
          "Variable": "$.value",
          "NumericGreaterThanEquals": 20
        },
        {
          "Variable": "$.value",
          "NumericLessThan": 30
        }
      ],
      "Assign": {
        "range": "twenties"
      },
      "Next": "ValueInTwenties"
    },
    {
      "Variable": "$.rating",
      "NumericGreaterThanPath": "$.auditThreshold",
      "Next": "StartAudit"
    }
  ],
  "Default": "RecordEvent",
  "Assign": {
    "range": "default"
  }
}

```

In this example, suppose the machine is started with an input value of:

```
{
  "type": "Private",
  "value": 22
}

```

Then the interpreter will assign the string `"twenties"` to `range` before transitioning to the "ValueInTwenties" state, based on the "value" field.

A Choice Rule MUST be either a Boolean Expression or a Data-test Expression.

#### Boolean expression for JSONPath Choice Rules

A Boolean Expression is a JSON object which contains a field named "And", "Or", or "Not". If the field name is "And" or "Or", the value MUST be a non-empty object array of Choice Rules, which MUST NOT contain "Next" fields; the interpreter processes the array elements in order, performing the boolean evaluations in the expected fashion, ceasing array processing when the boolean value has been unambiguously determined.

The value of a Boolean Expression containing a "Not" field MUST be a single Choice Rule, that MUST NOT contain a "Next" field; it returns the inverse of the boolean to which the Choice Rule evaluates.

#### Data-test expression for JSONPath Choice Rules

A Data-test Expression Choice Rule is an assertion about a field and its value which yields a boolean depending on the data. A Data-test Expression MUST contain a field named "Variable" whose value MUST be a Path.

Each choice rule MUST contain exactly one field containing a comparison operator. The following comparison operators are supported:

1.  StringEquals, StringEqualsPath
2.  StringLessThan, StringLessThanPath
3.  StringGreaterThan, StringGreaterThanPath
4.  StringLessThanEquals, StringLessThanEqualsPath
5.  StringGreaterThanEquals, StringGreaterThanEqualsPath
6.  StringMatches

    Note: The value MUST be a String which MAY contain one or more "\*" characters. The expression yields true if the data value selected by the Variable Path matches the value, where "\*" in the value matches zero or more characters. Thus, `foo*.log` matches `foo23.log`, `*.log` matches `zebra.log`, and `foo*.*` matches `foobar.zebra`. No characters other than "\*" have any special meaning during matching.

    If the character "\*" needs to appear as part of the value without serving as a wildcard, it MUST be escaped with a backslash.

    If the character "\\ needs to appear as part of the value without serving as an escape character, it MUST be escaped with a backslash.

    The literal string `\*` represents `*`.  
    The literal string `\\` represents `\`.

    In JSON, all backslashes contained in a string literal value must be escaped with another backslash, therefore, the preceding sequences will equate to:

    The escaped string `\\*` represents `*`.  
    The escaped string `\\\\` represents `\`.

    If an open escape backslash `\` is found in the StringMatches string, the interpreter will throw a runtime error.

7.  NumericEquals, NumericEqualsPath
8.  NumericLessThan, NumericLessThanPath
9.  NumericGreaterThan, NumericGreaterThanPath
10. NumericLessThanEquals, NumericLessThanEqualsPath
11. NumericGreaterThanEquals, NumericGreaterThanEqualsPath
12. BooleanEquals, BooleanEqualsPath
13. TimestampEquals, TimestampEqualsPath
14. TimestampLessThan, TimestampLessThanPath
15. TimestampGreaterThan, TimestampGreaterThanPath
16. TimestampLessThanEquals, TimestampLessThanEqualsPath
17. TimestampGreaterThanEquals, TimestampGreaterThanEqualsPath
18. IsNull

    Note: This means the value is the built-in JSON literal `null`.

19. IsPresent

    Note: In this case, if the Variable-field Path fails to match anything in the input no exception is thrown and the Choice Rule just returns false.

20. IsNumeric
21. IsString
22. IsBoolean
23. IsTimestamp

For those operators that end with "Path", the value MUST be a Path, to be applied to the state’s effective input to yield a value to be compared with the value yielded by the Variable path.

For each operator which compares values, if the values are not both of the appropriate type (String, number, boolean, or [Timestamp](#timestamps)) the comparison will return false. Note that a field which is thought of as a timestamp could be matched by a string-typed comparator.

The various String comparators compare strings character-by-character with no special treatments such as case-folding, white-space collapsing, or [Unicode form normalization](https://unicode.org/reports/tr15/ 'Unicode Normalization Forms').

Note that for interoperability, numeric comparisons should not be assumed to work with values outside the magnitude or precision representable using the IEEE 754-2008 "binary64" data type. In particular, integers outside of the range \[-(253)+1, (253)-1\] might fail to compare in the expected way.

A Choice State MAY have a "Default" field, whose value MUST be a string whose value MUST match a State name; that state will execute if none of the Choice Rules match. The interpreter will throw a runtime States.NoChoiceMatched error if a Choice State fails to match a Choice Rule and no "Default" transition was specified.

A Choice State MUST NOT be an End state.

### Wait State

A Wait State (identified by `"Type":"Wait"`) causes the interpreter to delay the machine from continuing for a specified time. The time can be specified as a wait duration, specified in seconds, or an absolute expiry time, which MUST conform to the [RFC3339](https://www.ietf.org/rfc/rfc3339.txt 'RFC 3339') profile of ISO 8601, with the further restrictions that an uppercase "T" character MUST be used to separate date and time, and an uppercase "Z" character MUST be present in the absence of a numeric time zone offset, for example "2016-03-14T01:59:00Z".

A Wait State MAY have an "Assign" field to assign variables.

For example, the following Wait State introduces a ten-second delay into a state machine:

```
"wait_ten_seconds" : {
  "Type" : "Wait",
  "Seconds" : 10,
  "Next": "NextState"
}

```

This waits until an absolute time:

```
"wait_until" : {
  "Type": "Wait",
  "Timestamp": "2016-03-14T01:59:00Z",
  "Next": "NextState"
}

```

Both the seconds and timestamp can be provided indirectly.

#### JSONata Wait State

A JSONata Wait State MAY specify a JSONata string for the "Seconds" field whose value, when evaluated, MUST be a non-negative integer. It MAY specify a JSONata string for the "Timestamp" field whose value, when evaluated, MUST be a string containing a valid timestamp.

This example uses a JSONata expression to look up the timestamp from data that might look like `{ "expirydate": "2016-03-14T01:59:00Z" }`:

```
"wait_until" : {
  "Type": "Wait",
  "QueryLanguage": "JSONata",
  "Timestamp": "{% $states.input.expirydate %}",
  "Next": "NextState"
}

```

A JSONata Wait State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the Wait State copies its input through to its output.

A JSONata Wait State MUST contain exactly one of "Seconds" or "Timestamp".

#### JSONPath Wait State

A JSONPath Wait State MAY have a "SecondsPath" field which MUST be a Reference Path which, when resolved, MUST select a field whose value is a non-negative integer. It MAY have a "TimestampPath" field which MUST be a Reference Path which, when resolved, MUST select a field whose value is a valid timestamp.

This example uses a Reference Path to look up the timestamp from data that might look like `{ "expirydate": "2016-03-14T01:59:00Z" }`:

```
"wait_until" : {
  "Type": "Wait",
  "TimestampPath": "$.expirydate",
  "Next": "NextState"
}

```

A JSONPath Wait State MUST contain exactly one of "Seconds", "SecondsPath", "Timestamp", or "TimestampPath".

### Succeed State

The Succeed State (identified by `"Type": "Succeed"`) either terminates a state machine successfully, ends a branch of a Parallel State, or ends an iteration of a Map State.

The Succeed State is a useful target for Choice-State branches that do not do anything except terminate the machine.

A JSONata Succeed State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the Succeed State copies its input through to its output.

The output of a JSONPath Succeed State is the same as its input, possibly modified by "InputPath" and/or "OutputPath".

Here is an example:

```
"SuccessState": {
  "Type": "Succeed"
}

```

Because Succeed States are terminal states, they have no "Next" field.

### Fail State

The Fail State (identified by `"Type": "Fail"`) terminates the machine and marks it as a failure.

Here is an example:

```
"FailState": {
  "Type": "Fail",
  "Error": "ErrorA",
  "Cause": "Kaiju attack"
}

```

A Fail State MAY have a field named "Error", whose value MUST be a string whose value provides an error name that can be used for error handling (Retry/Catch), operational, or diagnostic purposes. A Fail State MAY have a field named "Cause", whose value MUST be a string whose value provides a human-readable message.

Because Fail States are terminal states, they have no "Next" field.

Both the "Error" and "Cause" can be provided indirectly.

#### JSONata Fail State

A JSONata Fail State MAY specify JSONata strings for the "Error" and "Cause" fields whose values, when evaluated, MUST be string values.

Here is an example that sets the Error and Cause values dynamically from the state input rather than using static values:

```
"FailState": {
  "Type": "Fail",
  "QueryLanguage": "JSONata",
  "Comment": "my error comment",
  "Error": "{% $states.input.Error %}",
  "Cause": "{% $states.input.Cause %}"
}

```

#### JSONPath Fail State

A JSONPath Fail state MAY have "ErrorPath" and "CausePath" fields whose values MUST be Reference Paths or Intrinsic Functions which, when resolved, MUST be string values. A Fail state MUST NOT include both "Error" and "ErrorPath" or both "Cause" and "CausePath".

Here is an example that sets the Error and Cause values dynamically from the state input rather than using static values:

```
"FailState": {
  "Type": "Fail",
  "Comment": "my error comment",
  "ErrorPath": "$.Error",
  "CausePath": "$.Cause"
}

```

### Parallel State

The Parallel State (identified by `"Type": "Parallel"`) causes parallel execution of "branches".

Here is an example:

```
"LookupCustomerInfo": {
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "LookupAddress",
      "States": {
        "LookupAddress": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:us-east-1:123456789012:function:AddressFinder",
          "End": true
        }
      }
    },
    {
      "StartAt": "LookupPhone",
      "States": {
        "LookupPhone": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:us-east-1:123456789012:function:PhoneFinder",
          "End": true
        }
      }
    }
  ],
  "Next": "NextState"
}

```

A Parallel State causes the interpreter to execute each branch starting with the state named in its "StartAt" field, as concurrently as possible, and wait until each branch terminates (reaches a terminal state) before processing the Parallel State's "Next" field. In the previous example, this means the interpreter waits for "LookupAddress" and "LookupPhoneNumber" to both finish before transitioning to "NextState".

In the previous example, the LookupAddress and LookupPhoneNumber branches are executed in parallel.

A Parallel State MUST contain a field named "Branches" which is an array whose elements MUST be objects. Each object MUST contain fields named "States" and "StartAt" whose meanings are exactly like those in the top level of a State Machine.

A state in a Parallel State branch "States" field MUST NOT have a "Next" field that targets a field outside of that "States" field. A state MUST NOT have a "Next" field which matches a state name inside a Parallel State branch’s "States" field unless it is also inside the same "States" field.

Put another way, states in a branch’s "States" field can transition only to each other, and no state outside of that "States" field can transition into it.

If any branch fails, due to an unhandled error or by transitioning to a Fail State, the entire Parallel State is considered to have failed and all the branches are terminated. If the error is not handled by the Parallel State, the interpreter should terminate the machine execution with an error.

Unlike a Fail State, a Succeed State within a Parallel merely terminates its own branch. A Succeed State passes its input through as its output, possibly modified by "Output" for JSONata, or "InputPath" and "OutputPath" for JSONPath.

A JSONata Parallel State MAY have an "Arguments" field which, if present, provides the input for each branch's "StartAt" state. If "Arguments" is not provided, the state input is passed as the input to each branch's "StartAt" state.

A JSONPath Parallel State MAY have an "InputPath" field, whose value MUST be a path, to filter the state input, and MAY have a "Parameters" field, whose value MUST be a Payload Template which is used to generate the effective input to each branch's "StartAt" state.

The Parallel State generates a result which is an array with one element for each branch containing the output from that branch. The elements of the output array correspond to the branches in the same order that they appear in the "Branches" array. There is no requirement that all elements be of the same type.

A JSONata Parallel State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the state output is the result, meaning the output array containing the branch outputs.

A JSONPath Parallel State MAY have a "ResultSelector" field, whose value MUST be a Payload Template which is used to generate the effective result, MAY have a "ResultPath" field which is used to insert the effective result into the input data, and MAY have an "OutputPath" field, whose value MUST be a path which is used to create the state output in the usual way.

For example, consider the following Parallel State:

```
"FunWithMath": {
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "Add",
      "States": {
        "Add": {
          "Type": "Task",
          "Resource": "arn:aws:states:::task:Add",
          "End": true
        }
      }
    },
    {
      "StartAt": "Subtract",
      "States": {
        "Subtract": {
          "Type": "Task",
          "Resource": "arn:aws:states:::task:Subtract",
          "End": true
        }
      }
    }
  ],
  "Next": "NextState"
}

```

If the "FunWithMath" state was given the JSON array `[3, 2]` as input, then both the "Add" and "Subtract" states would receive that array as input. The output of "Add" would be `5`, that of "Subtract" would be `1`, and the output of the Parallel State would be a JSON array:

### Map State

The Map State (identified by `"Type": "Map"`) causes the interpreter to process all the elements of an array, potentially in parallel, with the processing of each element independent of the others. This document uses the term "iteration" to describe each such nested execution.

The Parallel State applies multiple different state-machine branches to the same input, while the Map State applies a single state machine to multiple input elements.

There are several fields which may be used to control the execution. To summarize:

1.  The "ItemProcessor" (or deprecated "Iterator") field's value is an object that defines a state machine which will process each item or batch of items of the array.
2.  For JSONata, the "Items" field's value is a JSON array or a JSONata string that MUST produce a JSON array. For JSONPath, the "ItemsPath" field's value is a Reference Path identifying where in the effective input the array field is found. The selected array is called the Items Array.
3.  The "ItemReader" field's value is an object that specifies where to read the items instead of from the effective input.
4.  The "ItemSelector" (or deprecated JSONPath "Parameters") field's value is an object that overrides each single element of the Items Array.
5.  The "ItemBatcher" field's value is an object that specifies how to batch the items for the ItemProcessor.
6.  The "ResultWriter" field's value is an object that specifies where to write the results instead of to the Map state's result.
7.  The "MaxConcurrency" field's value is an integer that provides an upper bound on how many invocations of the Iterator may execute in parallel.
8.  The "ToleratedFailurePercentage" field's value is an integer that provides an upper bound on the percentage of items that may fail.
9.  The "ToleratedFailureCount" field's value is an integer that provides an upper bound on how many items may fail.

The Map State generates a result as described in [Writing Results](#writing-results).

A JSONata Map State MAY have an "Output" field whose value, if present, will become the state output. If "Output" is not provided, the state output is the result.

A JSONPath Map State MAY have a "ResultSelector" field, whose value MUST be a Payload Template which is used to generate the effective result, MAY have a "ResultPath" field which is used to insert the effective result into the input data, and MAY have an "OutputPath" field, whose value MUST be a path which is used to create the state output in the usual way.

Consider the following example input data:

```
{
  "ship-date": "2016-03-14T01:59:00Z",
  "detail": {
    "delivery-partner": "UQS",
    "shipped": [
      { "prod": "R31", "dest-code": 9511, "quantity": 1344 },
      { "prod": "S39", "dest-code": 9511, "quantity": 40 },
      { "prod": "R31", "dest-code": 9833, "quantity": 12 },
      { "prod": "R40", "dest-code": 9860, "quantity": 887 },
      { "prod": "R40", "dest-code": 9511, "quantity": 1220 }
    ]
  }
}

```

Suppose it is desired to apply a single Lambda function, "ship-val", to each of the elements of the "shipped" array. Here is an example of an appropriate Map State.

#### JSONata Map State

```
"Validate-All": {
  "Type": "Map",
  "QueryLanguage": "JSONata",
  "Items": "{% $states.input.detail.shipped %}",
  "MaxConcurrency": 0,
  "ItemProcessor": {
    "StartAt": "Validate",
    "States": {
      "Validate": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ship-val",
        "End": true
      }
    }
  },
  "Assign": {
    "shipped": "{% $states.result %}"
  },
  "Output": {
    "numItemsProcessed": "{% $count($states.input.detail.shipped) %}"
  },
  "End": true
}

```

In the previous example, the "ship-val" Lambda function will be executed once for each element of the "shipped" field. The input to one iteration will be:

```
{
  "prod": "R31",
  "dest-code": 9511,
  "quantity": 1344
}

```

Suppose that the "ship-val" function also needs access to the shipment’s courier, which would be the same in each iteration. The "ItemSelector" field may be used to construct the raw input for each iteration:

```
"Validate-All": {
  "Type": "Map",
  "QueryLanguage": "JSONata",
  "Items": "{% $states.input.detail.shipped %}",
  "MaxConcurrency": 0,
  "ItemSelector": {
    "parcel": "{% $states.context.Map.Item.Value %}",
    "courier": "{% $states.input.delivery-partner %}"
  },
  "ItemProcessor": {
    "StartAt": "Validate",
    "States": {
      "Validate": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ship-val",
        "End": true
      }
    }
  },
  "Assign": {
    "shipped": "{% $states.result %}"
  },
  "Output": {
    "numItemsProcessed": "{% $count($states.input.detail.shipped) %}"
  },
  "End": true
}

```

The "ship-val" Lambda function will be executed once for each element of the array selected by "Items". In the previous example, the raw input to one iteration, as specified by "ItemSelector", will be:

```
{
  "parcel": {
    "prod": "R31",
    "dest-code": 9511,
    "quantity": 1344
   },
   "courier": "UQS"
}

```

In the previous examples, the "Assign" field assigns the result to variable `shipped`, and the "Output" field assigns the number of items to variable `numItemsProcessed`.

#### JSONPath Map State

```
"Validate-All": {
  "Type": "Map",
  "InputPath": "$.detail",
  "ItemsPath": "$.shipped",
  "MaxConcurrency": 0,
  "ItemProcessor": {
    "StartAt": "Validate",
    "States": {
      "Validate": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ship-val",
        "End": true
      }
    }
  },
  "ResultPath": "$.detail.shipped",
  "End": true
}

```

In the previous example, the "ship-val" Lambda function will be executed once for each element of the "shipped" field. The input to one iteration will be:

```
{
  "prod": "R31",
  "dest-code": 9511,
  "quantity": 1344
}

```

Suppose that the "ship-val" function also needs access to the shipment’s courier, which would be the same in each iteration. The "ItemSelector" field may be used to construct the raw input for each iteration:

```
"Validate-All": {
  "Type": "Map",
  "InputPath": "$.detail",
  "ItemsPath": "$.shipped",
  "MaxConcurrency": 0,
  "ItemSelector": {
    "parcel.$": "$.Map.Item.Value",
    "courier.$": "$.delivery-partner"
  },
  "ItemProcessor": {
    "StartAt": "Validate",
    "States": {
      "Validate": {
        "Type": "Task",
        "Resource": "arn:aws:lambda:us-east-1:123456789012:function:ship-val",
        "End": true
      }
    }
  },
  "ResultPath": "$.detail.shipped",
  "End": true
}

```

The "ship-val" Lambda function will be executed once for each element of the array selected by "ItemsPath". In the previous example, the raw input to one iteration, as specified by "ItemSelector", will be:

```
{
  "parcel": {
    "prod": "R31",
    "dest-code": 9511,
    "quantity": 1344
   },
   "courier": "UQS"
}

```

In the previous examples, the ResultPath results in the output being the same as the input, with the "detail.shipped" field being overwritten by an array in which each element is the output of the "ship-val" Lambda function as applied to the corresponding input element.

#### Map State input/output processing

In a JSONPath Map State, the "InputPath" field operates as usual, selecting part of the raw input - in the example, the value of the "detail" field - to serve as the effective input.

#### Reading Items

A Map State MAY have an "ItemReader" field, whose value MUST be a JSON object and is called the ItemReader Configuration. The ItemReader Configuration causes the interpreter to read items from the resource identified by the ItemReader Configuration’s "Resource" field.

The ItemReader Configuration MUST have a "Resource" field, whose value MUST be a URI that uniquely identifies the specific task to execute. The States Language does not constrain the URI scheme nor any other part of the URI. The ItemReader Configuration MAY have a "ReaderConfig" field whose value is a JSON object which MAY have a "MaxItems" field which MUST be a positive integer. The interpreter MAY define additional "ReaderConfig" fields.

In a JSONata Map State, the ItemReader Configuration MAY have an "Arguments" field, whose value MUST be a JSON object or a JSONata string that evaluates to a JSON object.

In a JSONPath Map State, the ItemReader Configuration MAY have a "Parameters" field, whose value MUST be a Payload Template.

The ItemReader Configuration causes the interpreter to read items from the task identified by the ItemReader’s "Resource" field. The interpreter will limit the number of items to the maximum number of items specified by the ReaderConfig’s "MaxItems" field. The "MaxItems" can be provided indirectly.

In a JSONata Map State, the "ReaderConfig" field's "MaxItems" field MAY be a JSONata string that MUST evaluate to a positive integer.

In a JSONPath Map State, a "ReaderConfig" field MAY have "MaxItemsPath" field which MUST be a Reference Path which, when resolved, MUST select a field whose value is a positive integer. A "ReaderConfig" field MUST NOT include both "MaxItems" and "MaxItemsPath".

In a JSONata Map State, the default result for "ItemReader" is the whole state input.

In a JSONPath Map State, the default result for "ItemReader" is "$", which is to say the whole effective input.

#### Selecting Items

A JSONata Map State MAY have an "Items" field, whose value MUST be a JSON array or a JSONata string that MUST evaluate to a JSON array, which is called the Items Array. The default value of "Items" is the whole ItemReader result. If a Map State has neither an "ItemReader" nor an "Items" field, the items array will be the state input, which MUST be a JSON array.

A JSONPath Map State MAY have an "ItemsPath" field, whose value MUST be a Reference Path. The Reference Path is applied to the ItemReader result and MUST identify a field whose value is a JSON array, which is called the Items Array. The default value of "ItemsPath" is "$", which is to say the whole ItemReader result. If a Map State has neither an "InputPath" nor an "ItemReader" nor an "ItemsPath" field, the items array will be the raw input, which MUST be a JSON array.

A JSONata Map State MAY have an "ItemSelector" field, whose value MUST be a JSON text, or a JSONata string that evaluates to a JSON text.

A JSONPath Map State MAY have an "ItemSelector" field, whose value MUST be a Payload Template.

The interpreter uses the "ItemSelector" field to override each single element of the item array. The result of the "ItemSelector" field is called the selected item.

In a JSONPath Map State, the "ItemSelector" field performs the same function as the "Parameters" field, which is now deprecated in the Map State.

The default of "ItemSelector" is a single element of the Items Array.

#### Batching Items

A Map State MAY have an "ItemBatcher" field, whose value MUST be a JSON object and is called the ItemBatcher Configuration. The ItemBatcher Configuration causes the interpreter to batch selected items into sub-arrays before passing them to each invocation. The interpreter will limit each sub-array to the maximum number of items specified by the "MaxItemsPerBatch" field, and to the maximum size in bytes specified by the "MaxInputBytesPerBatch" field.

In a JSONata Map State, the ItemBatcher Configuration MAY have a "BatchInput" field, whose value MUST be JSON text or a JSONata string that MUST evaluate to a JSON text. In a JSONPath Map State, the ItemBatcher Configuration MAY have a "BatchInput" field, whose value MUST be a Payload Template.

An ItemBatcher Configuration MAY have a "MaxItemsPerBatch" field, whose value MUST be a positive integer. An ItemBatcher Configuration MAY have a "MaxInputBytesPerBatch" field, whose value MUST be a positive integer.

The default of "ItemBatcher" is the selected item. Put another way, the interpreter will not batch items if no "ItemBatcher" field is provided.

Both the "MaxItemsPerBatch" and "MaxInputBytesPerBatch" can be provided indirectly.

A JSONata Map State MAY specify JSONata strings for the "MaxItemsPerBatch" or "MaxInputBytesPerBatch" fields, which MUST evaluate to positive integers.

A JSONPath Map State MAY have "MaxItemsPerBatchPath" and "MaxInputBytesPerBatchPath" fields which MUST be Reference Paths which, when resolved, MUST select fields whose values are positive integers. A Map State MUST NOT include both "MaxItemsPerBatch" and "MaxItemsPerBatchPath" or both "MaxInputBytesPerBatch" and "MaxInputBytesPerBatchPath".

An ItemBatcher Configuration MUST contain at least one of "MaxItemsPerBatch", "MaxItemsPerBatchPath", "MaxInputBytesPerBatch", or "MaxInputBytesPerBatchPath".

#### Processing Items

The input to each invocation, by default, is a single element of the Items Array, but may be overridden using the "ItemSelector" and/or "ItemBatcher" fields. If present, the interpreter uses the "ItemSelector" field to override each single element of the Items Array to produce an array of selected items. If present, the interpreter then uses the "ItemBatcher" field to specify how to batch the selected items array to produce an array of batched selected items.

For each item, within the Map State’s "ItemSelector" (or deprecated "Parameters") field, the Context Object will have an object field named "Map" which contains an object field named "Item" which in turn contains an integer field named "Index" whose value is the (zero-based) array index being processed and a field named "Value", whose value is the array element being processed.

#### Writing Results

A Map State MAY have a "ResultWriter" field, whose value MUST be a JSON object and is called the ResultWriter Configuration. The ResultWriter Configuration causes the interpreter to write results to the resource identified by the ResultWriter’s "Resource" field.

The ResultWriter Configuration MUST have a "Resource" field, whose value MUST be a URI that uniquely identifies the specific task to execute. The States Language does not constrain the URI scheme nor any other part of the URI.

In a JSONata Map State, the ResultWriter Configuration MAY have an "Arguments" field, whose value MUST be a JSON object or a JSONata string that evaluates to a JSON object.

In a JSONPath Map State, the ResultWriter Configuration MAY have a "Parameters" field, whose value MUST be a Payload Template.

If a "ResultWriter" field is provided, a Map State’s result is a JSON object containing fields defined by the interpreter. If a "ResultWriter" field is not specified, the result is a JSON array, whose value is either an array containing one element for each element of the Items Array, in the same order (if an "ItemBatcher" field is not specified), or an array containing one element for each batched sub-array of the Items Array, in the same order (if an "ItemBatcher" field is specified).

#### Map State concurrency

A Map State MAY have a non-negative integer "MaxConcurrency" field. Its default value is zero, which places no limit on invocation parallelism and requests the interpreter to execute the iterations as concurrently as possible.

If "MaxConcurrency" has a non-zero value, the interpreter will not allow the number of concurrent iterations to exceed that value.

A MaxConcurrency value of 1 is special, having the effect that interpreter will invoke the ItemProcessor once for each array element in the order of their appearance in the input, and will not start an iteration until the previous iteration has completed execution.

The "MaxConcurrency" can be provided indirectly.

A JSONata Map State MAY specify a JSONata string for the "MaxConcurrency" field, which MUST evaluate to a non-negative integer.

A JSONPath Map State MAY have "MaxConcurrencyPath" field which MUST be a Reference Path which, when resolved, MUST select a field whose value is a non-negative integer. A Map State MUST NOT include both "MaxConcurrency" and "MaxConcurrencyPath".

#### Map State ItemProcessor definition

A Map State MUST contain an object field named "ItemProcessor" (or deprecated "Iterator") which MUST contain fields named "States" and "StartAt", whose meanings are exactly like those in the top level of a State Machine. The "ItemProcessor" field performs the same function as the "Iterator" field, which is now deprecated in the Map State.

The "ItemProcessor" field MAY contain a field named "ProcessorConfig", whose value MUST be a JSON object whose value is defined by the interpreter. The interpreter will execute the ItemProcessor according to the ProcessorConfig.

A state in the "States" field of an "ItemProcessor" field MUST NOT have a "Next" field that targets a field outside of that "States" field. A state MUST NOT have a "Next" field which matches a state name inside an "ItemProcessor" field’s "States" field unless it is also inside the same "States" field.

Put another way, states in an ItemProcessor's "States" field can transition only to each other, and no state outside of that "States" field can transition into it.

If any iteration fails, due to an unhandled error or by transitioning to a Fail state, the entire Map State is considered to have failed and all the iterations are terminated. If the error is not handled by the Map State, the interpreter should terminate the machine execution with an error.

Unlike a Fail State, a Succeed State within a Map merely terminates its own iteration. A Succeed State passes its input through as its output, possibly modified by "Output" for JSONata, or "InputPath" and "OutputPath" for JSONPath.

#### Map State Failure Tolerance

A Map State MAY have a "ToleratedFailurePercentage" field whose value MUST be a number between zero and 100. Its default value is zero, which means the Map State will fail if any (i.e. more than 0%) of its items fail. A "ToleratedFailurePercentage" value of 100 means the interpreter will continue starting iterations even if all items fail.

A Map State MAY have a non-negative integer "ToleratedFailureCount" field. Its default value is zero, which means the Map State will fail if at least 1 of its items fail. If a "ToleratedFailurePercentage" field and a "ToleratedFailureCount" field are both specified, the Map State will fail if either threshold is breached.

Both the "ToleratedFailureCount" and "ToleratedFailurePercentage" can be provided indirectly.

A JSONata Map State MAY specify JSONata strings for the "ToleratedFailureCount" and "ToleratedFailurePercentage" fields, which MUST evaluate to non-negative integers.

A JSONPath Map State may have "ToleratedFailureCountPath" and "ToleratedFailurePercentagePath" fields which MUST be Reference Paths which, when resolved, MUST select fields whose values are non-negative integers. A Map State MUST NOT include both "ToleratedFailureCount" and "ToleratedFailureCountPath" or both "ToleratedFailurePercentage" and "ToleratedFailurePercentagePath".

## Appendices

### Appendix A: Predefined Error Codes

- Code: States.ALL
  - Description: A wildcard which matches any Error Name.
- Code: States.HeartbeatTimeout
  - Description: A Task State failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
- Code: States.Timeout
  - Description: A Task State either ran longer than the "TimeoutSeconds" value, or failed to heartbeat for a time longer than the "HeartbeatSeconds" value.
- Code: States.TaskFailed
  - Description: A Task State failed during the execution.
- Code: States.Permissions
  - Description: A Task State failed because it had insufficient privileges to execute the specified code.
- Code: States.ResultPathMatchFailure
  - Description: A state’s "ResultPath" field cannot be applied to the input the state received.
- Code: States.ParameterPathFailure
  - Description: Within a state’s "Parameters" field, the attempt to replace a field whose name ends in ".$" using a Path failed.
- Code: States.QueryEvaluationError
  - Description: Query evaluation failed in a JSONata state, such as a JSONata type error, an incorrectly typed result, or an undefined result.
- Code: States.BranchFailed
  - Description: A branch of a Parallel State failed.
- Code: States.NoChoiceMatched
  - Description: A Choice State failed to find a match for the condition field extracted from its input.
- Code: States.IntrinsicFailure
  - Description: Within a Payload Template, the attempt to invoke an Intrinsic Function failed.
- Code: States.ExceedToleratedFailureThreshold
  - Description: A Map state failed because the number of failed items exceeded the configured tolerated failure threshold.
- Code: States.ItemReaderFailed
  - Description: A Map state failed to read all items as specified by the "ItemReader" field.
- Code: States.ResultWriterFailed
  - Description: A Map state failed to write all results as specified by the "ResultWriter" field.

### Appendix B: List of JSONPath Intrinsic Functions

The States Language provides a set of intrinsic functions that provide additional functionality for JSONPath. Intrinsic functions MAY be used in states that use the JSONPath query language, and MUST NOT be used in states that use any other query language.

#### States.Format

This Intrinsic Function takes one or more arguments. The Value of the first MUST be a string, which MAY include zero or more instances of the character sequence `{}`. There MUST be as many remaining arguments in the Intrinsic Function as there are occurrences of `{}`. The interpreter returns the first-argument string with each `{}` replaced by the Value of the positionally-corresponding argument in the Intrinsic Function.

If necessary, the `{` and `}` characters can be escaped respectively as `\\{` and `\\}`.

If the argument is a Path, applying it to the input MUST yield a value that is a string, a boolean, a number, or `null`. In each case, the Value is the natural string representation; string values are not accompanied by enclosing `"` characters. The Value MUST NOT be a JSON array or object.

For example, given the following Payload Template:

```
{
  "Parameters": {
    "foo.$": "States.Format('Your name is {}, we are in the year {}', $.name, 2020)"
  }
}

```

Suppose the input to the Payload Template is as follows:

```
{
  "name": "Foo",
  "zebra": "stripe"
}

```

After processing the Payload Template, the new payload becomes:

```
{
  "foo": "Your name is Foo, we are in the year 2020"
}

```

#### States.StringToJson

This Intrinsic Function takes a single argument whose Value MUST be a string. The interpreter applies a JSON parser to the Value and returns its parsed JSON form.

For example, given the following Payload Template:

```
{
  "Parameters": {
    "foo.$": "States.StringToJson($.someString)"
  }
}

```

Suppose the input to the Payload Template is as follows:

```
{
  "someString": "{\"number\": 20}",
  "zebra": "stripe"
}

```

After processing the Payload Template, the new payload becomes:

```
{
  "foo": {
    "number": 20
  }
}

```

#### States.JsonToString

This Intrinsic Function takes a single argument which MUST be a Path. The interpreter returns a string which is a JSON text representing the data identified by the Path.

For example, given the following Payload Template:

```
{
  "Parameters": {
    "foo.$": "States.JsonToString($.someJson)"
  }
}

```

Suppose the input to the Payload Template is as follows:

```
{
  "someJson": {
    "name": "Foo",
    "year": 2020
  },
  "zebra": "stripe"
}

```

After processing the Payload Template, the new payload becomes:

```
{
  "foo": "{\"name\":\"Foo\",\"year\":2020}"
}

```

#### States.Array

This Intrinsic Function takes zero or more arguments. The interpreter returns a JSON array containing the Values of the arguments, in the order provided.

For example, given the following Payload Template:

```
{
  "Parameters": {
    "foo.$": "States.Array('Foo', 2020, $.someJson, null)"
  }
}

```

Suppose the input to the Payload Template is as follows:

```
{
  "someJson": {
    "random": "abcdefg"
  },
  "zebra": "stripe"
}

```

After processing the Payload Template, the new payload becomes:

```
{
  "foo": [
    "Foo",
    2020,
    {
      "random": "abcdefg"
    },
    null
  ]
}

```

#### States.ArrayPartition

Use the `States.ArrayPartition` intrinsic function to partition a large array or to slice the data and then send the payload in smaller chunks.

This intrinsic function takes two arguments. The first argument is an array, while the second argument defines the chunk size. The interpreter chunks the input array into multiple arrays of the size specified by chunk size. The length of the last array chunk may be less than the length of the previous array chunks if the number of remaining items in the array is smaller than the chunk size.

**Input validation**

- The first argument MUST be an array.
- The second argument MUST be a non-zero, positive integer, representing the chunk size value.

For example, given the following input array:

```
{ "inputArray": [1,2,3,4,5,6,7,8,9] }

```

Use the `States.ArrayPartition` function to divide the array into chunks of four values:

```
{ "inputArray.$": "States.ArrayPartition($.inputArray,4)" }

```

Which would return the following array chunks:

```
{ "inputArray": [ [1,2,3,4], [5,6,7,8], [9]] }

```

In the previous example, the `States.ArrayPartition` function outputs three arrays. The first two arrays each contain four values, as defined by the chunk size. A third array contains the remaining value and is smaller than the defined chunk size.

#### States.ArrayContains

Use the `States.ArrayContains` intrinsic function to determine if a specific value is present in an array. For example, use this function to detect if there was an error in a `Map` state iteration.

This intrinsic function takes two arguments. The first argument is an array, while the second argument is the value to be searched for within the array.

**Input validation**

- The first argument MUST be an array
- The second argument MUST be a JSON object

For example, given the following input array:

```
{ "inputArray": [1,2,3,4,5,6,7,8,9], "lookingFor": 5 }

```

Use the `States.ArrayContains` function to find the `lookingFor` value within the `inputArray`:

```
{ "contains.$": "States.ArrayContains($.inputArray, $.lookingFor)" }

```

Because the value stored in `lookingFor` is included in the `inputArray`, `States.ArrayContains` returns the following result:

#### States.ArrayRange

Use the `States.ArrayRange` intrinsic function to create a new array containing a specific range of elements. The new array can contain up to 1000 elements.

This function takes three arguments. The first argument is the first element of the new array, the second argument is the final element of the new array, and the third argument is the increment value between the elements in the new array.

**Input validation**

- All arguments MUST be integer values.
- The third argument MUST NOT be zero.
- The newly generated array MUST NOT contain more than 1000 items.

For example, the following use of the `States.ArrayRange` function will create an array with a first value of 1, a final value of 9, and values in between the first and final values increase by two for each item:

```
{ "array.$": "States.ArrayRange(1, 9, 2)" }

```

Which would return the following array:

#### States.ArrayGetItem

This intrinsic function returns a specified index's value. This function takes two arguments. The first argument is an array of values and the second argument is the array index of the value to return.

For example, use the following `inputArray` and `index` values:

```
{ "inputArray": [1,2,3,4,5,6,7,8,9], "index": 5 }

```

Use the `States.ArrayGetItem` function to return the value in the `index` position 5 within the array:

```
{ "item.$": "States.ArrayGetItem($.inputArray, $.index)" }

```

In this example, `States.ArrayGetItem` would return the following result:

#### States.ArrayLength

The `States.ArrayLength` intrinsic function returns the length of an array. It has one argument, the array to return the length of.

For example, given the following input array:

```
{ "inputArray": [1,2,3,4,5,6,7,8,9] }

```

Use `States.ArrayLength` to return the length of `inputArray`:

```
{ "length.$": "States.ArrayLength($.inputArray)" }

```

In this example, `States.ArrayLength` would return the following JSON object that represents the array length:

#### States.ArrayUnique

The `States.ArrayUnique` intrinsic function removes duplicate values from an array and returns an array containing only unique elements. This function takes an array, which can be unsorted, as its sole argument.

For example, the following `inputArray` contains a series of duplicate values:

```
{ "inputArray": [1,2,3,3,3,3,3,3,4] }

```

The `States.ArrayUnique` function can be used to remove duplicate values from the array:

```
{ "array.$": "States.ArrayUnique($.inputArray)" }

```

The `States.ArrayUnique` function would return the following array containing only unique elements, removing all duplicate values:

#### States.Base64Encode

Use the `States.Base64Encode` intrinsic function to encode data based on MIME Base64 encoding scheme. For example, use this function to pass data to other AWS services without using an AWS Lambda function.

This function takes a data string of up to 10,000 characters to encode as its only argument.

For example, consider the following `input` string:

```
{ "input": "Data to encode" }

```

Use the `States.Base64Encode` function to encode the `input` string as a MIME Base64 string:

```
{ "base64.$": "States.Base64Encode($.input)" }

```

The `States.Base64Encode` function returns the following encoded data in response:

```
{ "base64": "RGF0YSB0byBlbmNvZGU=" }

```

#### States.Base64Decode

Use the `States.Base64Decode` intrinsic function to decode data based on MIME Base64 decoding scheme. For example, use this function to pass data to other AWS services without using a Lambda function.

This function takes a Base64 encoded data string of up to 10,000 characters to decode as its only argument.

For example, given the following input:

```
{ "base64": "RGF0YSB0byBlbmNvZGU=" }

```

Use the `States.Base64Decode` function to decode the base64 string to a human-readable string:

```
{ "data.$": "States.Base64Decode($.base64)" }

```

The `States.Base64Decode function` would return the following decoded data in response:

```
{ "data": "Decoded data" }

```

#### States.Hash

Use the `States.Hash` intrinsic function to calculate the hash value of a given input. For example, use this function to pass data to other AWS services without using a Lambda function.

This function takes two arguments. The first argument is the data to hash. The length of the stringified version of the first argument must be 10,000 characters or less. The second argument is the hashing algorithm to use to perform the hash calculation.

The hashing algorithm can be any of the following algorithms:

- MD5
- SHA-1
- SHA-256
- SHA-384
- SHA-512

For example, given the `Data` string and a specific `Algorithm`:

```
{ "Data": "input data", "Algorithm": "SHA-1" }

```

Use the `States.Hash` function to calculate the hash value:

```
{ "output.$": "States.Hash($.Data, $.Algorithm)" }

```

The `States.Hash` function returns the following hash value in response:

```
{ "output": "aaff4a450a104cd177d28d18d7485e8cae074b7" }

```

#### States.JsonMerge

Use the `States.JsonMerge` intrinsic function to merge two JSON objects into a single object. This function takes three arguments. The first two arguments are the JSON objects to merge. The third argument is a boolean value that is `false` to do a shallow merge, and `true` to do a deep merge.

In shallow mode, if the same field name exists in both JSON objects, the latter object's field overrides the field with the same name in the first object.

In deep mode, if the same field name exists in both JSON objects, and both fields are themselves JSON objects, the function merges them. Deep mode repeats this process recursively.

For example, use the `States.JsonMerge` function to merge the following JSON arrays that both have a field named `a`.

```
{
  "json1": { "a": {"a1": 1, "a2": 2}, "b": 2, },
  "json2": { "a": {"a3": 1, "a4": 2}, "c": 3 }
}

```

Specify the `json1` and `json2` arrays as inputs in the `States.JasonMerge` function to merge them together:

```
{ "output.$": "States.JsonMerge($.json1, $.json2, false)" }

```

The `States.JsonMerge` returns the following merged JSON object as result. In the merged JSON object `output`, the `json2` object's field `a` replaces the `json1` object's field `a`. Also, the nested object in `json1` object's field `a` is discarded because shallow mode does not support merging nested objects.

```
{ "output": { "a": {"a3": 1, "a4": 2}, "b": 2, "c": 3 } }

```

#### States.MathRandom

Use the `States.MathRandom` intrinsic function to return a random number between the specified start and end number. For example, use this function to distribute a specific task between two or more resources.

This function takes three arguments. The first argument is the start number, the second argument is the end number, and the last argument controls the seed value. The seed value argument is optional.

Each use of this function with the same seed value will produce the same result.

Important

Because the `States.MathRandom` function does not return cryptographically secure random numbers, we recommend not to use it for security sensitive applications.

**Input validation**

- The start number and end number MUST be integers.

For example, to generate a random number from between one and 999, use the following input values:

```
{ "start": 1, "end": 999 }

```

To generate the random number, provide the `start` and `end` values to the `States.MathRandom` function:

```
{ "random.$": "States.MathRandom($.start, $.end)" }

```

The `States.MathRandom` function returns the following random number as a response:

#### States.MathAdd

Use the `States.MathAdd` intrinsic function to return the sum of two numbers. For example, use this function to increment values inside a loop without invoking a Lambda function.

**Input validation**

- All arguments MUST be integers.

For example, use the following values to subtract one from 111:

```
{ "value1": 111, "step": -1 }

```

Then, use the `States.MathAdd` function defining `value1` as the starting value, and `step` as the value to increment `value1` by:

```
{ "value1.$": "States.MathAdd($.value1, $.step)" }

```

The `States.MathAdd` function would return the following number in response:

#### States.StringSplit

Use the `States.StringSplit` intrinsic function to split a string into an array of values. This function takes two arguments. The first argument is a string and the second argument is the delimiting character that the function will use to divide the string.

For example, use `States.StringSplit` to divide the following `inputString`, which contains a series of comma separated values:

```
{ "inputString": "1,2,3,4,5", "splitter": "," }

```

Use the `States.StringSplit` function and define `inputString` as the first argument, and the delimiting character `splitter` as the second argument:

```
{ "array.$": "States.StringSplit($.inputString, $.splitter)" }

```

The `States.StringSplit` function returns the following string array as result:

```
{ "array": ["1","2","3","4","5"] }

```

#### States.UUID

Use the `States.UUID` intrinsic function to return a version 4 universally unique identifier (v4 UUID) generated using random numbers. For example, use this function to call other AWS services or resources that need a UUID parameter or insert items in a DynamoDB table.

The `States.UUID` function is called with no arguments specified:

```
{ "uuid.$": "States.UUID()" }

```

The function returns a randomly generated UUID, for example:

```
{ "uuid": "ca4c1140-dcc1-40cd-ad05-7b4aa23df4a8" }

```

## Document History

### November 22, 2024

- Add support for variables
  - Add Assign field
- Add support for JSONata query language
  - Add QueryLanguage field (top-level and state-level)
  - Add new fields
    - Arguments
    - Output
    - Items (Map state)
    - Condition (Choice state)
  - Disable JSONPath-only fields for JSONata
    - InputPath
    - Parameters
    - ResultSelector
    - ResultPath
    - OutputPath
    - Choice rules
      - Variable
      - All comparison fields such as StringEquals, StringEqualsPath, StringLessThan, StringLessThanPath, etc. (replaced by Condition)
    - Map state
      - ItemsPath
      - MaxConcurrencyPath
      - ToleratedFailureCountPath
      - ToleratedFailurePercentagePath
    - Task state
      - TimeoutSecondsPath
      - HeartbeatSecondsPath
    - Wait state
      - SecondsPath
      - TimestampPath
    - Fail state
      - ErrorPath
      - CausePath
  - Add States.QueryEvaluationError error name

### September 7, 2023

- Fail State fields added
  - ErrorPath
  - CausePath
- Retrier fields added
  - MaxDelaySeconds
  - JitterStrategy

### December 1, 2022

- Map fields added
  - ItemReader
  - ItemSelector (synonym for Parameters which is now deprecated in Map)
  - ItemBatcher
  - ItemProcessor (synonym for Iterator which is now deprecated in Map)
  - ResultWriter
  - MaxConcurrencyPath
  - ToleratedFailurePercentage
  - ToleratedFailurePercentagePath
  - ToleratedFailureCount
  - ToleratedFailureCountPath

### November 18, 2022

- Credentials added to Task state

### August 31, 2022

- Intrinsic Functions added
  - States.ArrayPartition
  - States.ArrayContains
  - States.ArrayRange
  - States.ArrayGetItem
  - States.ArrayLength
  - States.ArrayUnique
  - States.Base64Encode
  - States.Base64Decode
  - States.Hash
  - States.JsonMerge
  - States.MathRandom
  - States.MathAdd
  - States.StringSplit
  - States.UUID

### August 11, 2020

- Choice Rules added
  - StringMatches
  - IsNull, IsPresent, IsNumeric, IsString, IsBoolean, IsTimestamp
  - StringEqualsPath, StringLessThanPath, StringGreaterThanPath, StringLessThanEqualsPath, StringGreaterThanEqualsPath, NumericEqualsPath, NumericLessThanPath, NumericGreaterThanPath, NumericLessThanEqualsPath, NumericGreaterThanEqualsPath, BooleanEqualsPath, TimestampEqualsPath, TimestampLessThanPath, TimestampGreaterThanPath, TimestampLessThanEqualsPath, TimestampGreaterThanEqualsPath
- TimeoutSecondsPath and HeartbeatSecondsPath added to Task State
- Payload Template added
  - ResultSelector in Task State, Parallel State, and Map State
- Intrinsic Functions added
  - States.Format
  - States.StringToJson
  - States.JsonToString
  - States.Array
