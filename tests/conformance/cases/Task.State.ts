import { expect } from 'vite-plus/test';
import { ExecutionError } from '../../../src/utils/executionError';
import { customDefinitionCase } from '../support/builders';
import { getDeploymentConfig } from '../support/deploymentConfig';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Task.State';
const awsLambdaInvokeResource = 'arn:aws:states:::lambda:invoke';
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

const expectTaskJsonataContextProjection = (result: TestResult) => {
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
          Id: expect.any(String),
          Input: {
            hello: 'world',
            nested: {
              answer: 42,
            },
          },
          StartTime: expect.any(String),
          Name: expect.any(String),
          RoleArn: expect.any(String),
          RedriveCount: 0,
        },
        StateMachine: {
          Id: expect.any(String),
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
  });

  const output = result.output as {
    payload: {
      input: { hello: 'world'; nested: { answer: 42 } };
      context: { Execution: { RedriveCount: number }; Task: { Token: string } };
      inputString: string;
      contextString: string;
    };
    event: {
      payload: {
        input: { hello: 'world'; nested: { answer: 42 } };
        context: { Task: { Token: string } };
      };
      taskToken: string;
    };
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

const expectTaskJsonataResultProjection = (result: TestResult) => {
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
        Id: expect.any(String),
        Input: {
          hello: 'world',
          nested: {
            answer: 42,
          },
        },
        StartTime: expect.any(String),
        Name: expect.any(String),
        RoleArn: expect.any(String),
        RedriveCount: 0,
      },
      StateMachine: {
        Id: expect.any(String),
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
      SdkResponseMetadata: { RequestId: string };
    };
    statusCode: number;
  };

  expect(JSON.parse(output.payloadString)).toEqual(output.payload);
  expect(JSON.parse(output.resultString)).toEqual(output.rawResult);
  expect(output.rawResult.Payload.requestId).toBe(output.payload.requestId);
  expect(output.rawResult.SdkResponseMetadata.RequestId).toBe(output.payload.requestId);
  expect(output.rawResult.StatusCode).toBe(output.statusCode);
};

export const taskStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-local-mocked-happy-path',
    title: 'invokes a task and returns its result payload',
    group,
    tags: ['happy_path'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'return { ok: true, echoed: payload };',
              },
              'payload.$': '$',
            },
          },
          OutputPath: '$.Payload',
          End: true,
        },
      },
    },
    input: {
      orderId: 'ord-123',
      amount: 42,
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => ({
        ExecutedVersion: '$LATEST',
        Payload: {
          ok: true,
          echoed: (payload as { Payload: { payload: unknown } }).Payload.payload,
        },
        StatusCode: 200,
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
      notes:
        'Promoted after confirming on AWS that the baseline Task invocation flow can be asserted directly through the Lambda payload wrapper.',
    },
  }),
  customDefinitionCase({
    id: '002-parameters-shape-task-input',
    title: 'applies Parameters before invoking the task resource',
    group,
    tags: ['happy_path', 'parameters'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script: 'return payload;',
              },
              payload: {
                action: 'validate',
                request: {
                  'customerId.$': '$.customer.id',
                  'sku.$': '$.item.sku',
                  'quantity.$': '$.item.quantity',
                },
                'original.$': '$',
              },
            },
          },
          OutputPath: '$.Payload',
          End: true,
        },
      },
    },
    input: {
      customer: { id: 'cust-7', tier: 'gold' },
      item: { sku: 'sku-1', quantity: 3 },
    },
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => ({
        ExecutedVersion: '$LATEST',
        Payload: (payload as { Payload: { payload: unknown } }).Payload.payload,
        StatusCode: 200,
      }),
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
      notes:
        'Promoted after confirming on AWS that Parameters shaping can be asserted directly through a Lambda echo payload.',
    },
  }),
  customDefinitionCase({
    id: '003-compose-resultselector-resultpath-outputpath',
    title: 'composes ResultSelector, ResultPath, and OutputPath after task invocation',
    group,
    tags: ['happy_path', 'result_selector', 'result_path', 'output_path'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          InputPath: '$.job',
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  'return { rawId: `job-${payload.jobName}`, metrics: { score: payload.attempt * 10 }, debug: payload };',
              },
              payload: {
                'jobName.$': '$.name',
                'attempt.$': '$.attempt',
              },
            },
          },
          ResultSelector: {
            normalized: {
              'id.$': '$.Payload.rawId',
              'score.$': '$.Payload.metrics.score',
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
      [awsLambdaInvokeResource]: payload => {
        const taskInput = (
          payload as { Payload: { payload: { jobName: string; attempt: number } } }
        ).Payload.payload;
        return {
          ExecutedVersion: '$LATEST',
          Payload: {
            rawId: `job-${taskInput.jobName}`,
            metrics: {
              score: taskInput.attempt * 10,
            },
            debug: taskInput,
          },
          StatusCode: 200,
        };
      },
    }),
    expected: expectExactOutput({
      id: 'job-daily-report',
      score: 30,
    }),
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Promoted after confirming on AWS that Task post-processing can compose ResultSelector, ResultPath, and OutputPath over the Lambda wrapper shape.',
    },
  }),
  customDefinitionCase({
    id: '004-catch-transition-on-local-failure',
    title: 'transitions via Catch when a task fails',
    group,
    tags: ['error_handling', 'catch'],
    definition: {
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
          Parameters: {
            FunctionName: awsLambdaFixtureArn,
            Payload: {
              config: {
                script:
                  "const err = new Error('temporary outage'); err.name = 'TransientError'; throw err;",
              },
            },
          },
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
      [awsLambdaInvokeResource]: () => {
        throw new ExecutionError('TransientError', 'temporary outage');
      },
    }),
    expected: result => {
      expect(result.error).toBeUndefined();
      expect(result.cause).toBeUndefined();
      expect(result.output).toMatchObject({
        jobId: 'job-9',
        taskError: {
          Error: 'TransientError',
          Cause: expect.any(String),
        },
        recovery: {
          recovered: true,
        },
      });
      expect((result.output as { taskError: { Cause: string } }).taskError.Cause).toContain(
        'temporary outage'
      );
    },
    source: {
      file: 'src/states/index.spec.ts',
      notes:
        'Promoted after confirming on AWS that Catch transitions can be asserted against the stable Task error code plus a message substring inside the error cause payload.',
    },
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
    title: 'projects JSONata $states.input and $states.context through a task callback payload',
    group,
    tags: ['happy_path', 'jsonata_projection', 'lambda', 'context', 'task_token'],
    definition: {
      Comment: 'Project JSONata Step Functions runtime state through a task callback payload',
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
    setupLocalResources: () => ({
      [awsLambdaInvokeWaitForTaskTokenResource]: payload => {
        const request = payload as {
          Payload: {
            payload: unknown;
            taskToken: string;
          };
        };

        return {
          payload: request.Payload.payload,
          event: {
            payload: request.Payload.payload,
            taskToken: request.Payload.taskToken,
          },
          taskTokenVar: request.Payload.taskToken,
        };
      },
    }),
    expected: expectTaskJsonataContextProjection,
    notes:
      'Dual-environment conformance case for projecting $states.input and $states.context through a callback task payload. The local handler mirrors the callback output shape so the assertion stays structural across both runners.',
    source: {
      file: 'docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html',
      notes:
        'Consolidates the former AWS observation and local mirror into one dual-environment case that protects stable JSONata context projection semantics.',
    },
  }),
  customDefinitionCase({
    id: '007-aws-lambda-jsonata-result-observation',
    title: 'projects JSONata $states.result metadata and payload through optimized lambda invoke',
    group,
    tags: ['happy_path', 'jsonata_projection', 'lambda', 'result'],
    definition: {
      Comment: 'Project JSONata Step Functions task result through optimized Lambda invoke',
      QueryLanguage: 'JSONata',
      StartAt: 'Invoke',
      States: {
        Invoke: {
          Type: 'Task',
          Resource: awsLambdaInvokeResource,
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
    setupLocalResources: () => ({
      [awsLambdaInvokeResource]: payload => {
        const request = payload as { Payload: { payload: unknown } };
        return {
          ExecutedVersion: '$LATEST',
          Payload: {
            fromLambda: true,
            echoed: request.Payload.payload,
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
        };
      },
    }),
    expected: expectTaskJsonataResultProjection,
    notes:
      'Dual-environment conformance case for projecting $states.result after optimized lambda invoke. The local handler returns the same stable wrapper fields the runtime projects from AWS results.',
    source: {
      file: 'docs.aws.amazon.com/step-functions/latest/dg/connect-lambda.html',
      notes:
        'Consolidates the former AWS observation and local mirror into one dual-environment case that protects stable $states.result projection semantics.',
    },
  }),
];
