# Transforming data with JSONata in Step Functions - AWS Step Functions

With JSONata, you gain a powerful open source query and expression language to **select** and **transform** data in your workflows. For a brief introduction and complete JSONata reference, see [JSONata.org documentation](https://docs.jsonata.org/overview.html).

###### Supported JSONata version

Step Functions supports JSONata version 2.0.6.

You must opt-in to use the JSONata query and transformation language for existing workflows. When creating a workflow in the console, we recommend choosing JSONata for the top-level state machine `QueryLanguage`. For existing or new workflows that use JSONPath, the console provides an option to convert individual states to JSONata.

After selecting JSONata, your workflow fields will be reduced from five JSONPath fields (`InputPath`, `Parameters`, `ResultSelector`, `ResultPath`, and `OutputPath`) to only two fields: `Arguments` and `Output`. Also, you will **not** use `.$` on JSON object key names.

If you are new to Step Functions, you only need to know that JSONata expressions use the following syntax:

**JSONata syntax:** `"{% <JSONata expression> %}"`

The following code samples show a conversion from JSONPath to JSONata:

```
# Original sample using JSONPath
{
  "QueryLanguage": "JSONPath", // Set explicitly; could be set and inherited from top-level
  "Type": "Task",
  ...
  "Parameters": {
    "static": "Hello",
    "title.$": "$.title",
    "name.$": "$customerName",  // With $customerName declared as a variable
    "not-evaluated": "$customerName"
  }
}
```

```
# Sample after conversion to JSONata
{
  "QueryLanguage": "JSONata", // Set explicitly; could be set and inherited from top-level
  "Type": "Task",
  ...
  "Arguments": { // JSONata states do not have Parameters
    "static": "Hello",
    "title": "{% $states.input.title %}",
    "name": "{% $customerName %}",   // With $customerName declared as a variable
    "not-evaluated": "$customerName"
  }
}
```

Given input `{ "title" : "Doctor" }` and variable `customerName` assigned to `"María"`, both state machines will produce the following JSON result:

```json
{
  "static": "Hello",
  "title": "Doctor",
  "name": "María",
  "not-evaluated": "$customerName"
}
```

In the next diagram, you can see a graphical representation showing how converting JSONPath (left) to JSONata (right) will reduce the complexity of the steps in your state machines:

![Diagram that compares the fields in JSONPath and JSONata states.](https://docs.aws.amazon.com/images/step-functions/latest/dg/images/compare-jsonpath-jsonata.png)

You can (optionally) select and transform data from the state input into **Arguments** to send to your integrated action. With JSONata, you can then (optionally) select and transform the **results** from the action for assigning to variables and for state **Output**.

Note: **Assign** and **Output** steps occur in **parallel**. If you choose to transform data during variable assignment, that transformed data will **not** be available in the Output step. You must reapply the JSONata transformation in the Output step.

![Logical diagram of a state that uses JSONata query language.](https://docs.aws.amazon.com/images/step-functions/latest/dg/images/vars-jsonata.png)

## QueryLanguage field

In your workflow ASL definitions, there is a `QueryLanguage` field at the top level of a state machine definition and in individual states. By setting `QueryLanguage` inside individual states, you can incrementally adopt JSONata in an existing state machine rather than upgrading the state machine all at once.

The `QueryLanguage` field can be set to `"JSONPath"` or `"JSONata"`. If the top-level `QueryLanguage` field is omitted, it defaults to `"JSONPath"`. If a state contains a state-level `QueryLanguage` field, Step Functions will use the specified query language for that state. If the state does not contain a `QueryLanguage` field, then it will use the query language specified in the top-level `QueryLanguage` field.

## Writing JSONata expressions in JSON strings

When a string in the value of an ASL field, a JSON object field, or a JSON array element is surrounded by `{% %}` characters, that string will be evaluated as JSONata. Note, the string must start with `{%` with no leading spaces, and must end with `%}` with no trailing spaces. Improperly opening or closing the expression will result in a validation error.

Some examples:

- `"TimeoutSeconds" : "{% $timeout %}"`
- `"Arguments" : {"field1" : "{% $name %}"}` in a `Task` state
- `"Items": [1, "{% $two %}", 3]` in a `Map` state

Not all ASL fields accept JSONata. For example, each state's `Type` field must be set to a constant string. Similarly, the `Task` state's `Resource` field must be a constant string. The `Map` state `Items` field will accept a JSON array, a JSON object, or a JSONata expression that must evaluate to an array or object.

## Reserved variable: $states

Step Functions defines a single reserved variable called **`$states`**. In JSONata states, the following structures are assigned to `$states` for use in JSONata expressions:

```
# Reserved $states variable in JSONata states
$states = {
  "input":       // Original input to the state
  "result":      // API or sub-workflow's result (if successful)
  "errorOutput": // Error Output (only available in a Catch)
  "context":     // Context object
}
```

On state entry, Step Functions assigns the state input to **`$states.input`**. The value of `$states.input` can be used in all fields that accept JSONata expressions. `$states.input` always refers to the original state input.

For `Task`, `Parallel`, and `Map` states:

- **`$states.result`** refers to the API or sub-workflow's raw result if successful.
- **`$states.errorOutput`** refers to the Error Output if the API or sub-workflow failed. `$states.errorOutput` can be used in the `Catch` field's `Assign` or `Output`.

Attempting to access `$states.result` or `$states.errorOutput` in fields and states where they are not accessible will be caught at creation, update, or validation of the state machine.

The `$states.context` object provides your workflows information about their specific execution, such as `StartTime`, task token, and initial workflow input.

## Handling expression errors

At runtime, JSONata expression evaluation might fail for a variety of reasons, such as:

- **Type error** - An expression, such as `{% $x + $y %}`, will fail if `$x` or `$y` is not a number.
- **Type incompatibility** - An expression might evaluate to a type that the field will not accept. For example, the field `TimeoutSeconds` requires a numeric input, so the expression `{% $timeout %}` will fail if `$timeout` returns a string.
- **Value out of range** - An expression that produces a value that is outside the acceptable range for a field will fail. For example, an expression such as `{% $evaluatesToNegativeNumber %}` will fail in the `TimeoutSeconds` field.
- **Failure to return a result** - JSON cannot represent an undefined value expression, so the expression `{% $data.thisFieldDoesNotExist %}` would result in an error.
- **Memory limit exceeded** - A JSONata expression that consumes too much memory during evaluation will fail with an `Expression evaluation memory limit exceeded` error.
- **Expression timeout** - A JSONata expression that takes longer than 1 second to evaluate will fail with an `Expression evaluation timeout` error.
- **Stack overflow** - A JSONata expression that exceeds the maximum recursion depth will fail with a `Stack overflow error`.

In each case, the interpreter will throw the error: `States.QueryEvaluationError`. Your Task, Map, and Parallel states can provide a `Catch` field to catch the error, and a `Retry` field to retry on the error.

## Converting from JSONPath to JSONata

### No more path fields

ASL requires developers use `Path` versions of fields, as in `TimeoutSecondsPath`, to select a value from the state data when using JSONPath. When you use JSONata, you no longer use `Path` fields because ASL will interpret `{% %}`-enclosed JSONata expressions automatically for you in non-Path fields, such as `TimeoutSeconds`.

- JSONPath legacy example: `"TimeoutSecondsPath": "$timeout"`
- JSONata: `"TimeoutSeconds": "{% $timeout %}"`

Similarly, the `Map` state `ItemsPath` has been replaced with the `Items` field which accepts a JSON array, a JSON object, or a JSONata expression that must evaluate to an array or object.

### JSON Objects

ASL uses the term _payload template_ to describe a JSON object that can contain JSONPath expressions for `Parameters` and `ResultSelector` field values. ASL will not use the term payload template for JSONata because JSONata evaluation happens for all strings whether they occur on their own or inside a JSON object or a JSON array.

### No more .$

ASL requires you to append '`.$`' to field names in payload templates to use JSONPath and Intrinsic Functions. When you specify `"QueryLanguage":"JSONata"`, you no longer use the '`.$`' convention for JSON object field names. Instead, you enclose JSONata expressions in `{% %}` characters. You use the same convention for all string-valued fields, regardless of how deeply the object is nested inside other arrays or objects.

### Arguments and Output Fields

When the `QueryLanguage` is set to `JSONata`, the old I/O processing fields will be disabled (`InputPath`, `Parameters`, `ResultSelector`, `ResultPath` and `OutputPath`) and most states will get two new fields: `Arguments` and `Output`.

The `Arguments` and `Output` fields (and other similar fields such as `Map` state's `ItemSelector`) will accept either a JSON object such as:

```json
"Arguments": {
    "field1": 42,
    "field2": "{% jsonata expression %}"
}
```

Or, you can use a JSONata expression directly, for example:

```json
"Output": "{% jsonata expression %}"
```

Output can also accept any type of JSON value too, for example: `"Output":true`, `"Output":42`.

The `Arguments` and `Output` fields only support JSONata, so it is invalid to use them with workflows that use JSONPath. Conversely, `InputPath`, `Parameters`, `ResultSelector`, `ResultPath`, `OutputPath`, and other JSONPath fields are only supported in JSONPath, so it is invalid to use path-based fields when using JSONata as your top level workflow or state query language.

### Pass state

The optional **Result** in a Pass state was previously treated as the _output_ of a virtual task. With JSONata selected as the workflow or state query language, you can now use the new **Output** field.

### Choice state

When using JSONPath, choice states have an input `Variable` and numerous comparison paths:

```json
"Check Price": {
  "Type": "Choice",
  "Default": "Pause",
  "Choices": [
    {
      "Variable": "$.current_price.current_price",
      "NumericLessThanEqualsPath": "$.desired_price",
      "Next": "Send Notification"
    }
  ]
}
```

With JSONata, the choice state has a `Condition` where you can use a JSONata expression:

```json
"Check Price": {
  "Type": "Choice",
  "Default": "Pause",
  "Choices": [
    {
      "Condition": "{% $current_price <= $states.input.desired_price %}",
      "Next": "Send Notification"
    }
  ]
}
```

Note: Variables and comparison fields are only available for JSONPath. Condition is only available for JSONata.

## JSONata examples

### Example: Input and Output

```json
{
  "Comment": "Input and Output example using JSONata",
  "QueryLanguage": "JSONata",
  "StartAt": "Basic Input and Output",
  "States": {
    "Basic Input and Output": {
      "QueryLanguage": "JSONata",
      "Type": "Succeed",
      "Output": {
        "lastName": "{% 'Last=>' & $states.input.customer.lastName %}",
        "orderValue": "{% $states.input.order.total %}"
      }
    }
  }
}
```

Input:

```json
{
  "customer": { "firstName": "Martha", "lastName": "Rivera" },
  "order": { "items": 7, "total": 27.91 }
}
```

Output:

```json
{
  "lastName": "Last=>Rivera",
  "orderValue": 27.91
}
```

### Example: Filtering with JSONata

```json
{
  "Comment": "Filter products using JSONata",
  "QueryLanguage": "JSONata",
  "StartAt": "FilterDietProducts",
  "States": {
    "FilterDietProducts": {
      "Type": "Pass",
      "Output": {
        "dietProducts": "{% $states.input.products[calories=0] %}"
      },
      "End": true
    }
  }
}
```

## JSONata functions provided by Step Functions

JSONata contains function libraries for String, Numeric, Aggregation, Boolean, Array, Object, Date/Time, and High Order functions. Step Functions provides additional JSONata functions that serve as replacements for Step Functions intrinsic functions (which are only available in JSONPath states).

Note: Built-in JSONata functions that require integer values as parameters will automatically round down any non-integer numbers provided.

**`$partition`** - JSONata equivalent of `States.ArrayPartition`. Partitions a large array into chunks.

```json
"Assign": {
  "arrayPartition": "{% $partition([1,2,3,4], $states.input.chunkSize) %}"
}
```

**`$range`** - JSONata equivalent of `States.ArrayRange`. Generates an array of values.

```json
"Assign": {
  "arrayRange": "{% $range(0, 10, 2) %}"
}
```

**`$hash`** - JSONata equivalent of `States.Hash`. Calculates the hash value of a given input. Supported algorithms: `"MD5"`, `"SHA-1"`, `"SHA-256"`, `"SHA-384"`, `"SHA-512"`.

```json
"Assign": {
  "myHash": "{% $hash($states.input.content, $hashAlgorithmName) %}"
}
```

**`$random`** - JSONata equivalent of `States.MathRandom`. Returns a random number n where `0 ≤ n < 1`. Takes an optional integer seed; same seed returns identical number.

```json
"Assign": {
   "randNoSeed": "{% $random() %}",
   "randSeeded": "{% $random($states.input.seed) %}"
}
```

**`$uuid`** - JSONata version of `States.UUID`. Returns a v4 UUID. Takes no arguments.

```json
"Assign": {
  "uniqueId": "{% $uuid() %}"
}
```

**`$parse`** - Deserializes JSON strings. JSONata supports this via `$eval`, but `$eval` is not supported in Step Functions workflows.

```json
"Assign": {
  "deserializedPayload": "{% $parse($states.input.json_string) %}"
}
```

---

# Passing data between states with variables - AWS Step Functions

With variables and state output, you can pass data between the steps of your workflow.

Using workflow variables, you can store data in a step and retrieve that data in future steps. Conversely, state output can only be used as input to the very next step.

## Conceptual overview of variables

With workflow variables, you can store data to reference later. Without variables, you would need to pass the data through output from Step 1 to Step 2 to Step 3 to Step 4 to use it in Step 5. With variables, you can store data and use it in any future step.

**States that support variables**

The following state types support `Assign` to declare and assign values to variables: _Pass, Task, Map, Parallel, Choice, Wait._

```json
"Assign": {
  "productName": "product1",
  "count": 42,
  "available": true
}
```

To reference a variable, prepend the name with a dollar sign (`$`), for example, `$productName`.

## Reserved variable: $states

(See the JSONata section above — the same `$states` structure applies.)

## Variable name syntax

Variable names follow the rules for Unicode Identifiers (Unicode® Standard Annex #31). The first character must be a Unicode ID_Start character, subsequent characters must be Unicode ID_Continue characters. Maximum length: 80.

## Variable scope

Step Functions workflows avoid race conditions with variables by using a _workflow-local scope_.

Workflow-local scope includes all states inside a state machine's **States** field, but not states inside Parallel or Map states. States inside Parallel or Map states can refer to outer scope variables, but they create and maintain their own separate workflow-local variables.

- `Parallel` branches and `Map` iterations can access variable values from **outer scopes** but not from other concurrent branches or iterations.
- When handling errors, the `Assign` field in a `Catch` can assign values to variables in the outer scope.
- **Exception:** Distributed Map states cannot currently reference variables in outer scopes.
- A variable assigned in an inner scope cannot have the same name as one assigned in an outer scope.
- When a Parallel or Map state completes, all of their variables go out of scope. Use **Output** to pass data out of Parallel branches and Map iterations.

## Assign field in ASL

The `Assign` field is available at the top level of each state (except `Succeed` and `Fail`), inside `Choice` state rules, and inside `Catch` fields.

```json
"Store inputs": {
    "Type": "Pass",
    "Next": "Get Current Price",
    "Assign": {
       "desiredPrice": "{% $states.input.desired_price %}",
       "maximumWait": "{% $states.input.max_days %}"
    }
}
```

Task with assignment from result:

```json
{
  "Type": "Task",
  "Assign": {
    "product": "{% $states.input.order.product %}",
    "currentPrice": "{% $states.result.Payload.current_price %}"
  },
  "Next": "the next state"
}
```

Note: You **cannot** assign a value to a part of a variable. You can `"Assign":{"x":42}`, but you cannot `"Assign":{"x.y":42}` or `"Assign":{"x[2]":42}`.

## Evaluation order in an assign field

All variable references in Step Functions states use the values as they were on **state entry**. All expressions are **evaluated first**, then assignments are made. Newly assigned values will be available starting with the **next** state.

```
# Starting values: $x=3, $a=6

"Assign": {
  "x": "{% $a %}",
  "nextX": "{% $x %}"
}

# Ending values: $x=6, $nextX=3
```

The order in which the variables occur in the `Assign` field does **not** matter.

## Limits

- Maximum size of a single variable: 256 KiB (Standard and Express workflows).
- Maximum combined size for all variables in a single `Assign` field: 256 KiB.
- Total size of all stored variables: 10 MiB per execution.

## Using variables in JSONPath states

Variables are also available in states that use JSONPath. You can reference a variable in any field that accepts a JSONPath expression (`$.` or `$$.` syntax), except `ResultPath`.

```json
"Assign": {
  "products.$": "$.order..product",
  "orderTotal.$": "$.order.total"
}
```

For JSONPath states, the value of `$` in an `Assign` field depends on the state type:

- `Task`, `Map`, `Parallel`: `$` refers to the API/sub-workflow result.
- `Choice` and `Wait`: `$` refers to the effective input (after `InputPath`).
- `Pass`: `$` refers to the result (from `Result` field or `InputPath`/`Parameters`).

---

# Accessing execution data from the Context object in Step Functions - AWS Step Functions

The Context object is an internal JSON structure available during an execution, containing information about your state machine and execution.

## Accessing the Context object

**In JSONata:** use `$states.context` in a JSONata expression.

```json
{ "ExecutionID": "{% $states.context.Execution.Id %}" }
```

**In JSONPath:** append `.$` to the key, prepend value with `$$.`

```json
{ "ExecutionID.$": "$$.Execution.Id" }
```

JSONPath states can refer to context (`$$.`) from: `InputPath`, `OutputPath`, `ItemsPath` (Map), `Variable` (Choice), `ResultSelector`, `Parameters`, variable-to-variable comparison operators.

## Context object fields

```json
{
  "Execution": {
    "Id": "String",
    "Input": {},
    "Name": "String",
    "RoleArn": "String",
    "StartTime": "Format: ISO 8601",
    "RedriveCount": "Number",
    "RedriveTime": "Format: ISO 8601"
  },
  "State": {
    "EnteredTime": "Format: ISO 8601",
    "Name": "String",
    "RetryCount": "Number"
  },
  "StateMachine": {
    "Id": "String",
    "Name": "String"
  },
  "Task": {
    "Token": "String"
  }
}
```

`RedriveTime` is only available if you've redriven an execution.

Step Functions follows ISO8601 — when a timestamp has zero fractional seconds, trailing zeros are removed. Code consuming Step Functions timestamps must handle a variable number of fractional seconds.

## Context object data for Map states

Within a `Map` state, the Context object includes:

```json
"Map": {
   "Item": {
      "Index": "Number",
      "Key": "String",
      "Value": "String",
      "Source": "String"
   }
}
```

These are available only in a `Map` state and can be specified in the `ItemSelector` field.

`$states.context.Map.Item.Source` values:

- For state input: `STATE_DATA`
- For `S3:ListObjectsV2` with `Transformation=NONE`: S3 URI for the bucket, e.g. `S3://bucket-name`
- For all other input types: the Amazon S3 URI, e.g. `S3://bucket-name/object-key`

JSONata Map state context example:

```json
{
  "StartAt": "ExampleMapState",
  "States": {
    "ExampleMapState": {
      "Type": "Map",
      "ItemSelector": {
        "ContextIndex": "{% $states.context.Map.Item.Index %}",
        "ContextValue": "{% $states.context.Map.Item.Value %}",
        "ContextSource": "{% $states.context.Map.Item.Source %}"
      },
      "ItemProcessor": {
        "ProcessorConfig": { "Mode": "INLINE" },
        "StartAt": "TestPass",
        "States": {
          "TestPass": { "Type": "Pass", "End": true }
        }
      },
      "End": true
    }
  }
}
```

---

# Manipulate parameters in Step Functions workflows - AWS Step Functions

The `InputPath`, `Parameters` and `ResultSelector` fields provide a way to manipulate JSON as it moves through your workflow.

AWS Step Functions applies the `InputPath` field first, then the `Parameters` field. You can then use the `ResultSelector` field to manipulate the state's output before `ResultPath` is applied.

## InputPath

Use `InputPath` to select a portion of the state input.

```json
"InputPath": "$.dataset2"
```

A path can yield a selection of values. For example, applied to `{ "a": [1, 2, 3, 4] }`, the path `$.a[0:2]` returns `[1, 2]`.

## Parameters

Use the `Parameters` field to create a collection of key-value pairs passed as input. For key-value pairs where the value is selected using a path, the key name must end in `.$`.

```json
"Parameters": {
    "comment": "Selecting what I care about.",
    "MyDetails": {
        "size.$": "$.product.details.size",
        "exists.$": "$.product.availability",
        "StaticValue": "foo"
    }
}
```

## ResultSelector

Use the `ResultSelector` field to manipulate a state's result before `ResultPath` is applied. Available in `Map`, `Task`, and `Parallel` states.

```json
"ResultSelector": {
    "ClusterId.$": "$.output.ClusterId",
    "ResourceType.$": "$.resourceType"
}
```

### Flattening an array of arrays

If a `Parallel` or `Map` state returns an array of arrays, flatten them with `ResultSelector`:

```json
"ResultSelector": {
    "flattenArray.$": "$[*][*]"
}
```

---

# Example: Manipulating state data with paths in Step Functions workflows - AWS Step Functions

Any state other than `Fail` or `Succeed` can include the input and output processing fields `InputPath`, `ResultPath`, and `OutputPath`. `Wait` and `Choice` states don't support `ResultPath`.

Example state machine:

```json
{
  "Comment": "A Hello World example",
  "StartAt": "HelloWorld",
  "States": {
    "HelloWorld": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:region:123456789012:function:HelloFunction",
      "InputPath": "$.lambda",
      "ResultPath": "$.data.lambdaresult",
      "OutputPath": "$.data",
      "End": true
    }
  }
}
```

Given input:

```json
{
  "comment": "An input comment.",
  "data": { "val1": 23, "val2": 17 },
  "extra": "foo",
  "lambda": { "who": "AWS Step Functions" }
}
```

Processing chain:

1. `InputPath: "$.lambda"` — sends only `{"who": "AWS Step Functions"}` to Lambda.
2. `ResultPath: "$.data.lambdaresult"` — inserts Lambda result into `data.lambdaresult` in the original input.
3. `OutputPath: "$.data"` — filters to only the `data` node as final output.

Final output:

```json
{
  "val1": 23,
  "val2": 17,
  "lambdaresult": "Hello, AWS Step Functions!"
}
```

## Filtering state output using OutputPath

With `OutputPath` you can select a portion of the state output to pass to the next state. If you don't specify an `OutputPath`, the default value is `$` (the entire JSON node).

---

# ItemReader (Map) - AWS Step Functions

The `ItemReader` field is a JSON object that specifies a dataset and its location for a Distributed Map state.

**JSONPath-based** workflow:

```json
"ItemReader": {
    "ReaderConfig": {
        "InputType": "CSV",
        "CSVHeaderLocation": "FIRST_ROW"
    },
    "Resource": "arn:aws:states:::s3:getObject",
    "Parameters": {
        "Bucket": "amzn-s3-demo-bucket",
        "Key": "csvDataset/ratings.csv",
        "VersionId": "BcK42coT2jE1234VHLUvBV1yLNod2OEt"
    }
}
```

**JSONata-based** workflow (`Parameters` replaced with `Arguments`):

```json
"ItemReader": {
    "ReaderConfig": {
        "InputType": "CSV",
        "CSVHeaderLocation": "FIRST_ROW"
    },
    "Resource": "arn:aws:states:::s3:getObject",
    "Arguments": {
        "Bucket": "amzn-s3-demo-bucket",
        "Key": "csvDataset/ratings.csv",
        "VersionId": "BcK42coT2jE1234VHLUvBV1yLNod2OEt"
    }
}
```

## Contents of the ItemReader field

**`Resource`** — The Amazon S3 API integration action, e.g. `arn:aws:states:::s3:getObject`

**`Arguments` (JSONata) or `Parameters` (JSONPath)** — JSON object specifying the S3 bucket name and object key.

**`ReaderConfig`** — JSON object specifying:

- **`InputType`**: `CSV`, `JSON`, `JSONL`, `PARQUET`, `MANIFEST`. Specifies the type of S3 data source. Most input types support `ExpectedBucketOwner` and `VersionId` fields (except Parquet which does not support `VersionId`). External compression: GZIP, ZSTD.

- **`Transformation`** _(optional)_: `NONE` (default) or `LOAD_AND_FLATTEN`. When `LOAD_AND_FLATTEN`, map reads and processes the actual data objects referenced in `S3:ListObjectsV2` results rather than metadata objects. `InputType` is required when `Transformation` is `LOAD_AND_FLATTEN`.

- **`ManifestType`** _(optional)_: `ATHENA_DATA` or `S3_INVENTORY`. If `S3_INVENTORY`, do not specify `InputType` (assumed CSV).

- **`CSVDelimiter`** _(when InputType is CSV or MANIFEST)_: `COMMA` (default), `PIPE`, `SEMICOLON`, `SPACE`, `TAB`.

- **`CSVHeaderLocation`** _(when InputType is CSV or MANIFEST)_: `FIRST_ROW` or `GIVEN`. When `GIVEN`, supply headers in `CSVHeaders` array. Step Functions supports headers up to 10 KiB.

- **`ItemsPointer`** _(optional, when InputType is JSON)_: JSONPointer syntax to select a nested array or object. Target array's starting position must be within first 16 MB; path must be < 2000 characters.

- **`MaxItems`**: Limits the number of data items passed to the Map state. JSONPath workflows can also use `MaxItemsPath`. Maximum: 100,000,000.

S3 buckets must be in the same AWS account and AWS Region as your state machine.

## Processing nested data sets — LOAD_AND_FLATTEN (updated Sep 11, 2025)

With `Transformation: LOAD_AND_FLATTEN`, the map reads the **actual** data objects referenced by `S3:ListObjectsV2` rather than just metadata. Prior to this feature, nested Distributed Maps were required.

```json
"ItemReader": {
    "Resource": "arn:aws:states:::s3:listObjectsV2",
    "ReaderConfig": {
        "InputType": "JSON",
        "Transformation": "LOAD_AND_FLATTEN"
    },
    "Arguments": {
        "Bucket": "S3_BUCKET_NAME",
        "Prefix": "S3_BUCKET_PREFIX"
    }
}
```

Include a trailing slash on your prefix to avoid matching unintended folders.

## JSON file in S3 with ItemsPointer

```json
"ItemReader": {
   "Resource": "arn:aws:states:::s3:getObject",
   "ReaderConfig": {
      "InputType": "JSON",
      "ItemsPointer": "/inventory/products/featured"
   },
   "Arguments": {
      "Bucket": "amzn-s3-demo-bucket",
      "Key": "nested-data-file.json"
   }
}
```

## Parquet files

```json
"ItemReader": {
   "Resource": "arn:aws:states:::s3:getObject",
   "ReaderConfig": {
      "InputType": "PARQUET"
   },
   "Arguments": {
      "Bucket": "amzn-s3-demo-bucket",
      "Key": "my-parquet-data-file-1.parquet"
   }
}
```

Constraints: 256 MB max row-group size, 5 MB max footer size. `VersionId` not supported. Internal GZIP, ZSTD, Snappy compression natively supported.

## Athena manifest

```json
"ItemReader": {
   "Resource": "arn:aws:states:::s3:getObject",
   "ReaderConfig": {
      "ManifestType": "ATHENA_DATA",
      "InputType": "CSV"
   },
   "Arguments": {
      "Bucket": "<S3_BUCKET_NAME>",
      "Key": "<S3_KEY_PREFIX><QUERY_ID>-manifest.csv"
   }
}
```

Supported output formats: CSV, JSONL, Parquet. CSV objects from Athena `UNLOAD` do not include a header row.

## Amazon S3 inventory

`ManifestType: S3_INVENTORY` — do not specify `InputType`. Output format must be CSV.

## IAM policy recommendations

For `ListObjectsV2`:

```json
"Action": ["s3:ListBucket"],
"Resource": ["arn:aws:s3:::amzn-s3-demo-bucket"],
"Condition": {
   "StringLike": { "s3:prefix": ["/path/to/your/json/"] }
}
```

```json
"Action": ["s3:GetObject"],
"Resource": ["arn:aws:s3:::amzn-s3-demo-bucket/path/to/your/json/*"]
```
