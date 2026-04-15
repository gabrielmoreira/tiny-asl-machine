import { expect } from 'vitest';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Task.State';
const localEchoResource = 'local:task:echo';
const localShapeResource = 'local:task:shape';
const localNormalizeResource = 'local:task:normalize';
const localFailResource = 'local:task:fail';
const localJsonataContextResource = 'local:task:jsonata-context';
const localJsonataResultResource = 'local:task:jsonata-result';
const awsStsGetCallerIdentityResource = 'arn:aws:states:::aws-sdk:sts:getCallerIdentity';
const awsLambdaInvokeWaitForTaskTokenResource = 'arn:aws:states:::lambda:invoke.waitForTaskToken';
const awsLambdaFixtureArn =
  getDeploymentConfig().aws.lambdaFixtureArn ??
  'arn:aws:lambda:eu-west-1:000000000000:function:missing-fixture';

const expectExactOutput = (output: unknown) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toEqual(output);
};

const expectOutputShape = (shape: Record<string, unknown>) => (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject(shape);
};

const expectLambdaStatesContextObservation = (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({
    payload: {
      input: {
        hello: 'world',
        nested: {
          answer: 42,
        },
      },
      context: {
        Execution: {
          Id: expect.stringContaining(':execution:'),
          Input: {
            hello: 'world',
            nested: {
              answer: 42,
            },
          },
          StartTime: expect.any(String),
          Name: expect.any(String),
          RoleArn: expect.stringContaining(':role/'),
          RedriveCount: 0,
        },
        StateMachine: {
          Id: expect.stringContaining(':stateMachine:'),
          Name: expect.any(String),
        },
        State: {
          Name: 'Probe',
          EnteredTime: expect.any(String),
          RetryCount: 0,
        },
        Task: {
          Token: expect.any(String),
        },
      },
      inputString: expect.any(String),
      contextString: expect.any(String),
    },
    event: {
      payload: {
        input: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        context: {
          Execution: {
            Input: {
              hello: 'world',
              nested: {
                answer: 42,
              },
            },
          },
          Task: {
            Token: expect.any(String),
          },
        },
        inputString: expect.any(String),
        contextString: expect.any(String),
      },
      taskToken: expect.any(String),
    },
    taskTokenVar: expect.any(String),
    contextRequestId: expect.any(String),
  });

  const output = result.output as {
    payload: {
      input: { hello: 'world'; nested: { answer: 42 } };
      context: { Task: { Token: string } };
      inputString: string;
      contextString: string;
    };
    event: { taskToken: string };
    taskTokenVar: string;
  };

  expect(output.taskTokenVar).toBe(output.event.taskToken);
  expect(output.payload.context.Task.Token).toBe(output.event.taskToken);
  expect(JSON.parse(output.payload.inputString)).toEqual(output.payload.input);
  expect(JSON.parse(output.payload.contextString)).toMatchObject({
    Execution: {
      Input: output.payload.input,
      RedriveCount: 0,
    },
    Task: {
      Token: output.event.taskToken,
    },
  });
};

const expectLocalStatesContextProjection = (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({
    input: {
      hello: 'world',
      nested: {
        answer: 42,
      },
    },
    context: {
      Execution: {
        Input: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        RedriveCount: 0,
      },
      StateMachine: {
        Id: expect.stringContaining('machine-'),
        Name: 'machine',
      },
      State: {
        Name: 'Invoke',
        RetryCount: 0,
      },
      Task: {
        Token: expect.stringContaining('TaskToken-'),
      },
    },
    inputString: expect.any(String),
    contextString: expect.any(String),
    taskToken: expect.stringContaining('TaskToken-'),
  });

  const output = result.output as {
    input: { hello: 'world'; nested: { answer: 42 } };
    context: { Execution: { RedriveCount: number }; Task: { Token: string } };
    inputString: string;
    contextString: string;
    taskToken: string;
  };

  expect(JSON.parse(output.inputString)).toEqual(output.input);
  expect(JSON.parse(output.contextString)).toMatchObject({
    Execution: {
      Input: output.input,
      RedriveCount: 0,
    },
    Task: {
      Token: output.taskToken,
    },
  });
  expect(output.context.Task.Token).toBe(output.taskToken);
};

const expectLambdaStatesResultObservation = (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({
    rawResult: {
      ExecutedVersion: '$LATEST',
      Payload: {
        fromLambda: true,
        echoed: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        requestId: expect.any(String),
      },
      SdkHttpMetadata: {
        HttpStatusCode: 200,
        HttpHeaders: {
          'X-Amz-Executed-Version': '$LATEST',
          'Content-Type': 'application/json',
        },
      },
      SdkResponseMetadata: {
        RequestId: expect.any(String),
      },
      StatusCode: 200,
    },
    resultString: expect.any(String),
    payload: {
      fromLambda: true,
      echoed: {
        hello: 'world',
        nested: {
          answer: 42,
        },
      },
      requestId: expect.any(String),
    },
    payloadString: expect.any(String),
    statusCode: 200,
    executedVersion: '$LATEST',
    context: {
      Execution: {
        Id: expect.stringContaining(':execution:'),
        Input: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        StartTime: expect.any(String),
        Name: expect.any(String),
        RoleArn: expect.stringContaining(':role/'),
        RedriveCount: 0,
      },
      StateMachine: {
        Id: expect.stringContaining(':stateMachine:'),
        Name: expect.any(String),
      },
      State: {
        Name: 'Invoke',
        EnteredTime: expect.any(String),
        RetryCount: 0,
      },
    },
  });

  const output = result.output as {
    resultString: string;
    payloadString: string;
    payload: {
      requestId: string;
    };
    rawResult: {
      Payload: {
        requestId: string;
      };
      StatusCode: number;
    };
    statusCode: number;
  };

  expect(JSON.parse(output.payloadString)).toEqual(output.payload);
  expect(JSON.parse(output.resultString)).toEqual(output.rawResult);
  expect(output.rawResult.Payload.requestId).toBe(output.payload.requestId);
  expect(output.rawResult.StatusCode).toBe(output.statusCode);
};

const expectLocalStatesResultProjection = (result: TestResult) => {
  expect(result.error).toBeUndefined();
  expect(result.cause).toBeUndefined();
  expect(result.output).toMatchObject({
    rawResult: {
      ExecutedVersion: '$LATEST',
      Payload: {
        fromLambda: true,
        echoed: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        requestId: 'req-local-123',
      },
      SdkHttpMetadata: {
        HttpStatusCode: 200,
        HttpHeaders: {
          'X-Amz-Executed-Version': '$LATEST',
          'Content-Type': 'application/json',
        },
      },
      SdkResponseMetadata: {
        RequestId: 'req-local-123',
      },
      StatusCode: 200,
    },
    resultString: expect.any(String),
    payload: {
      fromLambda: true,
      echoed: {
        hello: 'world',
        nested: {
          answer: 42,
        },
      },
      requestId: 'req-local-123',
    },
    payloadString: expect.any(String),
    statusCode: 200,
    executedVersion: '$LATEST',
    context: {
      Execution: {
        Id: expect.stringContaining('execution-'),
        Input: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        StartTime: expect.any(String),
        Name: 'execution',
        RoleArn: 'machine-role',
        RedriveCount: 0,
      },
      StateMachine: {
        Id: expect.stringContaining('machine-'),
        Name: 'machine',
      },
      State: {
        Name: 'Invoke',
        EnteredTime: expect.any(String),
        RetryCount: 0,
      },
    },
  });

  const output = result.output as {
    resultString: string;
    payloadString: string;
    payload: {
      requestId: string;
    };
    rawResult: {
      Payload: {
        requestId: string;
      };
      StatusCode: number;
    };
    statusCode: number;
  };

  expect(JSON.parse(output.payloadString)).toEqual(output.payload);
  expect(JSON.parse(output.resultString)).toEqual(output.rawResult);
  expect(output.rawResult.Payload.requestId).toBe(output.payload.requestId);
  expect(output.rawResult.StatusCode).toBe(output.statusCode);
};

export const taskStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-local-mocked-happy-path',
    title: 'invokes a local mocked task and returns its result',
    group,
    tags: ['happy_path', 'local_resource'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localEchoResource,
          End: true,
        },
      },
    },
    input: {
      orderId: 'ord-123',
      amount: 42,
    },
    setupLocalResources: () => ({
      [localEchoResource]: payload => ({
        ok: true,
        echoed: payload,
      }),
    }),
    expected: expectExactOutput({
      ok: true,
      echoed: {
        orderId: 'ord-123',
        amount: 42,
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Covers the baseline Task invocation flow with a local resource mock.',
    },
  }),
  customDefinitionCase({
    id: '002-parameters-shape-task-input',
    title: 'applies Parameters before invoking the task resource',
    group,
    tags: ['happy_path', 'parameters'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localShapeResource,
          Parameters: {
            action: 'validate',
            request: {
              'customerId.$': '$.customer.id',
              'sku.$': '$.item.sku',
              'quantity.$': '$.item.quantity',
            },
            'original.$': '$',
          },
          End: true,
        },
      },
    },
    input: {
      customer: { id: 'cust-7', tier: 'gold' },
      item: { sku: 'sku-1', quantity: 3 },
    },
    setupLocalResources: () => ({
      [localShapeResource]: payload => payload,
    }),
    expected: expectExactOutput({
      action: 'validate',
      request: {
        customerId: 'cust-7',
        sku: 'sku-1',
        quantity: 3,
      },
      original: {
        customer: { id: 'cust-7', tier: 'gold' },
        item: { sku: 'sku-1', quantity: 3 },
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Extends Task parameter shaping coverage with nested structures.',
    },
  }),
  customDefinitionCase({
    id: '003-compose-resultselector-resultpath-outputpath',
    title: 'composes ResultSelector, ResultPath, and OutputPath after task invocation',
    group,
    tags: ['happy_path', 'result_selector', 'result_path', 'output_path'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localNormalizeResource,
          InputPath: '$.job',
          Parameters: {
            'jobName.$': '$.name',
            'attempt.$': '$.attempt',
          },
          ResultSelector: {
            normalized: {
              'id.$': '$.rawId',
              'score.$': '$.metrics.score',
            },
            source: 'task',
          },
          ResultPath: '$.task',
          OutputPath: '$.task.normalized',
          End: true,
        },
      },
    },
    input: {
      job: {
        name: 'daily-report',
        attempt: 3,
      },
      ignored: true,
    },
    setupLocalResources: () => ({
      [localNormalizeResource]: payload => {
        const taskInput = payload as { jobName: string; attempt: number };
        return {
          rawId: `job-${taskInput.jobName}`,
          metrics: {
            score: taskInput.attempt * 10,
          },
          debug: payload,
        };
      },
    }),
    expected: expectExactOutput({
      id: 'job-daily-report',
      score: 30,
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Mirrors Task post-processing semantics with a smaller assertion-focused flow.',
    },
  }),
  customDefinitionCase({
    id: '004-catch-transition-on-local-failure',
    title: 'transitions via Catch when a local task resource fails',
    group,
    tags: ['error_handling', 'catch'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localFailResource,
          Catch: [
            {
              ErrorEquals: ['TransientError'],
              ResultPath: '$.taskError',
              Next: 'Recovered',
            },
          ],
          End: true,
        },
        Recovered: {
          Type: 'Pass',
          Result: {
            recovered: true,
          },
          ResultPath: '$.recovery',
          End: true,
        },
      },
    },
    input: {
      jobId: 'job-9',
    },
    setupLocalResources: () => ({
      [localFailResource]: () => {
        throw new ExecutionError('TransientError', 'temporary outage');
      },
    }),
    expected: expectExactOutput({
      jobId: 'job-9',
      taskError: {
        Error: 'TransientError',
        Cause: 'temporary outage',
      },
      recovery: {
        recovered: true,
      },
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes: 'Based on the existing Task catch path, adapted to the conformance harness.',
    },
  }),
  customDefinitionCase({
    id: '008-local-jsonata-context-projection',
    title: 'projects $states.input and $states.context in a local task Arguments payload',
    group,
    tags: ['happy_path', 'jsonata_projection', 'local_context'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localJsonataContextResource,
          Arguments: {
            input: '{% $states.input %}',
            context: '{% $states.context %}',
            inputString: '{% $string($states.input) %}',
            contextString: '{% $string($states.context) %}',
            taskToken: '{% $states.context.Task.Token %}',
          },
          End: true,
        },
      },
    },
    input: {
      hello: 'world',
      nested: {
        answer: 42,
      },
    },
    setupLocalResources: () => ({
      [localJsonataContextResource]: payload => payload,
    }),
    expected: expectLocalStatesContextProjection,
    notes:
      'Local mirror of the AWS JSONata context probe using Task.Arguments and the local task token/context objects.',
  }),
  customDefinitionCase({
    id: '009-local-jsonata-result-projection',
    title: 'projects $states.result metadata and payload in a local task Output object',
    group,
    tags: ['happy_path', 'jsonata_projection', 'local_result'],
    awsExecutable: false,
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: localJsonataResultResource,
          Arguments: {
            input: '{% $states.input %}',
          },
          Output: {
            rawResult: '{% $states.result %}',
            resultString: '{% $string($states.result) %}',
            payload: '{% $states.result.Payload %}',
            payloadString: '{% $string($states.result.Payload) %}',
            statusCode: '{% $states.result.StatusCode %}',
            executedVersion: '{% $states.result.ExecutedVersion %}',
            context: '{% $states.context %}',
          },
          End: true,
        },
      },
    },
    input: {
      hello: 'world',
      nested: {
        answer: 42,
      },
    },
    setupLocalResources: () => ({
      [localJsonataResultResource]: payload => ({
        ExecutedVersion: '$LATEST',
        Payload: {
          fromLambda: true,
          echoed: (payload as { input: unknown }).input,
          requestId: 'req-local-123',
        },
        SdkHttpMetadata: {
          HttpHeaders: {
            'X-Amz-Executed-Version': '$LATEST',
            'Content-Type': 'application/json',
          },
          HttpStatusCode: 200,
        },
        SdkResponseMetadata: {
          RequestId: 'req-local-123',
        },
        StatusCode: 200,
      }),
    }),
    expected: expectLocalStatesResultProjection,
    notes:
      'Local mirror of the AWS optimized Lambda invoke result probe using $states.result and Output projections.',
  }),
  customDefinitionCase({
    id: '005-aws-sts-getcalleridentity-smoke',
    title: 'executes the AWS SDK STS GetCallerIdentity task integration',
    group,
    tags: ['happy_path', 'aws_smoke'],
    definition: {
      StartAt: 'GetCallerIdentity',
      States: {
        GetCallerIdentity: {
          Type: 'Task',
          Resource: awsStsGetCallerIdentityResource,
          Parameters: {},
          ResultSelector: {
            'accountId.$': '$.Account',
            'callerArn.$': '$.Arn',
            'principalId.$': '$.UserId',
          },
          End: true,
        },
      },
    },
    input: {},
    setupLocalResources: () => ({
      [awsStsGetCallerIdentityResource]: () => ({
        Account: '123456789012',
        Arn: 'arn:aws:sts::123456789012:assumed-role/ConformanceRole/ConformanceSession',
        UserId: 'AROA123456789EXAMPLE:ConformanceSession',
      }),
    }),
    expected: expectOutputShape({
      accountId: expect.stringMatching(/^\d{12}$/),
      callerArn: expect.stringContaining('arn:'),
      principalId: expect.any(String),
    }),
    notes:
      'Uses shape-based assertions because live AWS identity values vary by account and caller.',
    source: {
      file: 'src/states/index.ts',
      notes: 'AWS-executable smoke coverage for a real Step Functions AWS SDK Task integration.',
    },
  }),
  customDefinitionCase({
    id: '006-aws-lambda-jsonata-context-observation',
    title: 'observes JSONata $states.input and $states.context through Lambda callback',
    group,
    tags: ['aws_only', 'aws_observation', 'lambda', 'jsonata', 'task_token'],
    localExecutable: false,
    definition: {
      Comment: 'Observe JSONata Step Functions runtime state through Lambda callback',
      QueryLanguage: 'JSONata',
      StartAt: 'Probe',
      States: {
        Probe: {
          Type: 'Task',
          Resource: awsLambdaInvokeWaitForTaskTokenResource,
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'const sfn = new aws.sfn.SFNClient({}); await sfn.send(new aws.sfn.SendTaskSuccessCommand({ taskToken, output: JSON.stringify({ payload, event, taskTokenVar: taskToken, contextRequestId: context.awsRequestId }) })); return { callbackSent: true };',
              },
              payload: {
                input: '{% $states.input %}',
                context: '{% $states.context %}',
                inputString: '{% $string($states.input) %}',
                contextString: '{% $string($states.context) %}',
              },
              taskToken: '{% $states.context.Task.Token %}',
            },
          },
          End: true,
        },
      },
    },
    input: {
      hello: 'world',
      nested: {
        answer: 42,
      },
    },
    expected: expectLambdaStatesContextObservation,
    notes:
      'AWS-only observation case. Confirms that JSONata can pass $states.input and $states.context as objects, and $string(...) can serialize them before invoking the Lambda fixture.',
    source: {
      file: 'docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html',
      notes:
        'Reverse-engineering probe for Step Functions runtime context availability in JSONata Lambda invoke.waitForTaskToken arguments.',
    },
  }),
  customDefinitionCase({
    id: '007-aws-lambda-jsonata-result-observation',
    title: 'observes JSONata $states.result through optimized lambda invoke',
    group,
    tags: ['aws_only', 'aws_observation', 'lambda', 'jsonata', 'result'],
    localExecutable: false,
    definition: {
      Comment: 'Observe JSONata Step Functions task result through optimized Lambda invoke',
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Arguments: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'return { fromLambda: true, echoed: payload, requestId: context.awsRequestId };',
              },
              payload: '{% $states.input %}',
            },
          },
          Output: {
            rawResult: '{% $states.result %}',
            resultString: '{% $string($states.result) %}',
            payload: '{% $states.result.Payload %}',
            payloadString: '{% $string($states.result.Payload) %}',
            statusCode: '{% $states.result.StatusCode %}',
            executedVersion: '{% $states.result.ExecutedVersion %}',
            context: '{% $states.context %}',
          },
          End: true,
        },
      },
    },
    input: {
      hello: 'world',
      nested: {
        answer: 42,
      },
    },
    expected: expectLambdaStatesResultObservation,
    notes:
      'AWS-only observation case. Confirms the actual shape of $states.result for optimized lambda invoke and what parts can be directly serialized or projected with JSONata.',
    source: {
      file: 'docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html',
      notes:
        'Reverse-engineering probe for optimized Lambda invoke result shape, including metadata wrapper and parsed Payload behavior.',
    },
  }),
];
