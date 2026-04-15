import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONPathPipeline';
const sourceFile = 'src/states/index.ts';
const localShapeTaskResultResource = 'arn:local:jsonpath-pipeline:shape-task-result';
const localServiceResponseResource = 'arn:local:jsonpath-pipeline:service-response';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

export const featureJsonPathPipelineCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-inputpath-then-parameters',
    title: 'applies InputPath before Parameters build the effective payload',
    group,
    tags: ['happy_path', 'input_path', 'parameters', 'pipeline'],
    definition: {
      StartAt: 'BuildPayload',
      States: {
        BuildPayload: {
          Type: 'Pass',
          InputPath: '$.request',
          Parameters: {
            order: {
              'id.$': '$.order.id',
              'firstSku.$': '$.order.lines[0].sku',
            },
            'priority.$': '$.flags.priority',
            'traceId.$': '$$.Execution.Input.meta.traceId',
            stage: 'prepared',
          },
          End: true,
        },
      },
    },
    input: {
      meta: {
        traceId: 'trace-101',
      },
      request: {
        order: {
          id: 'ord-7',
          lines: [{ sku: 'sku-1', quantity: 2 }],
        },
        flags: {
          priority: 'expedited',
        },
      },
      flags: {
        priority: 'wrong-scope',
      },
    },
    expected: expectOutput({
      order: {
        id: 'ord-7',
        firstSku: 'sku-1',
      },
      priority: 'expedited',
      traceId: 'trace-101',
      stage: 'prepared',
    }),
    source: {
      file: sourceFile,
      notes:
        'Pins the first pipeline boundary by proving Parameters resolve against the InputPath-selected branch, not the outer root input.',
    },
  }),
  customDefinitionCase({
    id: '002-parameters-into-task-resultselector',
    title:
      'feeds Parameters output into a task and then reshapes the task result with ResultSelector',
    group,
    tags: ['happy_path', 'parameters', 'result_selector', 'task', 'pipeline'],
    definition: {
      StartAt: 'InvokeAndShape',
      States: {
        InvokeAndShape: {
          Type: 'Task',
          Resource: localShapeTaskResultResource,
          Parameters: {
            request: {
              'orderId.$': '$.order.id',
              'quantity.$': '$.order.quantity',
            },
            'expedite.$': '$.flags.expedite',
            stamp: 'prepared',
          },
          ResultSelector: {
            summary: {
              'orderId.$': '$.receipt.orderId',
              'quantity.$': '$.receipt.quantity',
              'accepted.$': '$.receipt.accepted',
            },
            'observedStamp.$': '$.audit.stamp',
            stage: 'selected',
          },
          End: true,
        },
      },
    },
    input: {
      order: {
        id: 'ord-9',
        quantity: 3,
      },
      flags: {
        expedite: true,
      },
      ignored: {
        orderId: 'wrong-order',
      },
    },
    setupLocalResources: () => ({
      [localShapeTaskResultResource]: payload => {
        const prepared = payload as {
          request: { orderId: string; quantity: number };
          expedite: boolean;
          stamp: string;
        };

        return {
          receipt: {
            orderId: prepared.request.orderId,
            quantity: prepared.request.quantity,
            accepted: prepared.expedite,
          },
          audit: {
            stamp: prepared.stamp,
          },
          raw: prepared,
        };
      },
    }),
    expected: expectOutput({
      summary: {
        orderId: 'ord-9',
        quantity: 3,
        accepted: true,
      },
      observedStamp: 'prepared',
      stage: 'selected',
    }),
    awsExecutable: false,
    skipReason:
      'Uses a local stub Task resource so the suite can observe the exact Parameters-to-task handoff before ResultSelector reshaping.',
    source: {
      file: sourceFile,
      notes:
        'Covers the middle of the pipeline by making the task output depend on the Parameters-shaped request and then selecting from that raw task result.',
    },
  }),
  customDefinitionCase({
    id: '003-task-resultpath-then-outputpath',
    title:
      'writes a task result through ResultPath before OutputPath projects from the merged structure',
    group,
    tags: ['happy_path', 'task', 'result_path', 'output_path', 'pipeline'],
    definition: {
      StartAt: 'CallService',
      States: {
        CallService: {
          Type: 'Task',
          Resource: localServiceResponseResource,
          ResultPath: '$.service.response',
          OutputPath: '$.service.response.summary.status',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-3',
      service: {
        name: 'billing',
        response: {
          summary: {
            status: 'stale',
          },
        },
      },
    },
    setupLocalResources: () => ({
      [localServiceResponseResource]: () => ({
        summary: {
          status: 'accepted',
          code: 202,
        },
        audit: {
          attempts: 1,
        },
      }),
    }),
    expected: expectOutput('accepted'),
    awsExecutable: false,
    skipReason:
      'Uses a local stub Task resource to isolate task-result plumbing while still asserting the AWS-shaped ordering of ResultPath before OutputPath.',
    source: {
      file: sourceFile,
      notes:
        'The projected path only exists after ResultPath insertion, so this case proves OutputPath reads from the post-merge structure rather than the raw task output or prior input.',
    },
  }),
  customDefinitionCase({
    id: '004-full-pipeline-across-flow',
    title:
      'composes InputPath, Parameters, ResultSelector, ResultPath, and OutputPath across one state-machine flow',
    group,
    tags: [
      'happy_path',
      'input_path',
      'parameters',
      'result_selector',
      'result_path',
      'output_path',
      'pipeline',
    ],
    definition: {
      StartAt: 'PrepareRequest',
      States: {
        PrepareRequest: {
          Type: 'Pass',
          InputPath: '$.request',
          Parameters: {
            pipeline: {
              request: {
                'customerId.$': '$.customer.id',
                'firstSku.$': '$.items[0].sku',
                'priority.$': '$.flags.priority',
              },
              meta: {
                'traceId.$': '$$.Execution.Input.meta.traceId',
              },
            },
          },
          Next: 'AnnotateResult',
        },
        AnnotateResult: {
          Type: 'Pass',
          Result: {
            service: {
              decision: {
                code: 'APPROVED',
                reviewer: 'system',
              },
            },
            emittedAt: '2024-01-01T00:00:00Z',
          },
          ResultSelector: {
            decision: {
              'code.$': '$.service.decision.code',
              'reviewer.$': '$.service.decision.reviewer',
            },
            'emittedAt.$': '$.emittedAt',
          },
          ResultPath: '$.pipeline.result',
          OutputPath: '$.pipeline',
          End: true,
        },
      },
    } as unknown as ConformanceCase['definition'],
    input: {
      meta: {
        traceId: 'trace-44',
      },
      request: {
        customer: {
          id: 'cust-77',
        },
        items: [{ sku: 'sku-9', quantity: 1 }],
        flags: {
          priority: 'rush',
        },
      },
    },
    expected: expectOutput({
      request: {
        customerId: 'cust-77',
        firstSku: 'sku-9',
        priority: 'rush',
      },
      meta: {
        traceId: 'trace-44',
      },
      result: {
        decision: {
          code: 'APPROVED',
          reviewer: 'system',
        },
        emittedAt: '2024-01-01T00:00:00Z',
      },
    }),
    awsExecutable: false,
    skipReason:
      'AWS currently rejects this full-pipeline characterization because the second Pass state uses ResultSelector; keep it local-only until the same composition is remodeled with an AWS-portable state shape.',
    source: {
      file: sourceFile,
      notes:
        'Uses two Pass states so the full transform order is observable without relying on local-only task resources.',
    },
  }),
  customDefinitionCase({
    id: '005-null-inputpath-with-downstream-parameters',
    title: 'documents current local InputPath null behavior when downstream Parameters still run',
    group,
    tags: ['boundary', 'input_path', 'parameters', 'null', 'pipeline', 'local_only'],
    definition: {
      StartAt: 'BuildFromNullInputPath',
      States: {
        BuildFromNullInputPath: {
          Type: 'Pass',
          InputPath: null as unknown as undefined,
          Parameters: {
            'customerId.$': '$.request.customer.id',
            'traceId.$': '$.meta.traceId',
            mode: 'local-characterization',
          },
          End: true,
        },
      },
    },
    input: {
      meta: {
        traceId: 'trace-null',
      },
      request: {
        customer: {
          id: 'cust-null',
        },
      },
      ignored: true,
    },
    expected: expectOutput({
      customerId: 'cust-null',
      traceId: 'trace-null',
      mode: 'local-characterization',
    }),
    awsExecutable: false,
    skipReason:
      'Local runtime currently ignores non-string InputPath values, so InputPath null remains a local characterization until AWS parity is pinned.',
    source: {
      file: sourceFile,
      notes:
        'Keeps the null-input case in the pipeline suite without overstating AWS semantics that are still ambiguous in the local runtime.',
    },
  }),
  customDefinitionCase({
    id: '006-resultpath-null-then-outputpath',
    title: 'applies OutputPath after ResultPath null preserves the original input',
    group,
    tags: ['happy_path', 'result_path', 'output_path', 'null', 'pipeline'],
    definition: {
      StartAt: 'DiscardResultThenProject',
      States: {
        DiscardResultThenProject: {
          Type: 'Pass',
          Result: {
            transient: {
              status: 'discard-me',
            },
          },
          ResultPath: null,
          OutputPath: '$.order.summary.total',
          End: true,
        },
      },
    },
    input: {
      requestId: 'req-6',
      order: {
        summary: {
          total: 42,
          currency: 'USD',
        },
      },
    },
    expected: expectOutput(42),
    source: {
      file: sourceFile,
      notes:
        'Shows that ResultPath null discards the state result first, after which OutputPath projects from the preserved original input.',
    },
  }),
  customDefinitionCase({
    id: '007-scalar-result-through-pipeline',
    title:
      'carries a scalar result through ResultPath and OutputPath after earlier Parameters shaping',
    group,
    tags: ['happy_path', 'parameters', 'result_path', 'output_path', 'scalar', 'pipeline'],
    definition: {
      StartAt: 'PrepareNumbers',
      States: {
        PrepareNumbers: {
          Type: 'Pass',
          Parameters: {
            calculations: {
              'base.$': '$.numbers.base',
            },
          },
          Next: 'EmitScalar',
        },
        EmitScalar: {
          Type: 'Pass',
          Result: 9,
          ResultPath: '$.calculations.total',
          OutputPath: '$.calculations',
          End: true,
        },
      },
    },
    input: {
      numbers: {
        base: 4,
      },
      ignored: true,
    },
    expected: expectOutput({
      base: 4,
      total: 9,
    }),
    source: {
      file: sourceFile,
      notes:
        'Adds the scalar-intermediate pipeline case from the roadmap while keeping the definition AWS-portable by using only Pass states.',
    },
  }),
];
