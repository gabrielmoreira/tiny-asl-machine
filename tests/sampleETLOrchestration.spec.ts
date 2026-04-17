import { definition } from './fixtures/sampleETLOrchestration';
import { run } from '../src';
import { describe, it, beforeEach, afterEach, expect, vitest, type Mock } from 'vite-plus/test';

const actions = [
  'build_database',
  'load_baseline_data',
  'load_customer_address',
  'load_item',
  'load_sales_fact',
  'validate_sales_metric',
] as const;

type ActionName = (typeof actions)[number];
type RedshiftDataApiParams = {
  input?: {
    action?: string;
    [key: string]: unknown;
  };
  status?: string;
};

type ActionHandler = (params: RedshiftDataApiParams) => Promise<unknown>;
type ResourceHandler = (payload: unknown) => Promise<unknown>;

describe('ETL workflow', () => {
  beforeEach(() => {
    vitest.useFakeTimers();
    vitest.spyOn(globalThis, 'setTimeout');
  });
  afterEach(() => {
    vitest.useRealTimers();
    vitest.clearAllMocks();
  });
  it('should execute a complex ETL workflow', async () => {
    // Given
    const redshiftOperationsMock = vitest
      .fn()
      // start cluster flow
      .mockResolvedValueOnce('paused') // first call is to check cluster status
      .mockResolvedValueOnce('resuming') // second call is to start cluster
      .mockResolvedValueOnce('available') // third call is  check cluster status
      // pause cluster flow
      .mockResolvedValueOnce('available') // first call is to pause cluster
      .mockResolvedValueOnce('paused'); // second call is to check cluster status
    const actionsMock: Record<string, Mock<ActionHandler>> = {};
    const redshiftDataApiMock = vitest
      .fn<ActionHandler>()
      .mockImplementation(async (params: RedshiftDataApiParams) => {
        const action = params.input?.action;
        if (!action) throw new Error('Action is required!');
        if (!actionsMock[action]) {
          // there are different actions running in parallel, so we will create a mock for each individual action
          actionsMock[action] = vitest
            .fn<ActionHandler>()
            .mockImplementationOnce(async (request: RedshiftDataApiParams) => request) // first call is to start an operation
            .mockResolvedValueOnce('PENDING') // second call is to check status of an operation
            .mockResolvedValueOnce('FINISHED'); // third call is to check status of an operation
        }
        const result = await actionsMock[action](params);
        return result;
      });
    const input = {};
    const mockResources: Record<string, ResourceHandler> = {
      'arn:aws:lambda:us-east-1:111122223333:function:CFN36-RedshiftOperations-AKIAIOSFODNN7EXAMPLE':
        async payload => await redshiftOperationsMock(payload),
      'arn:aws:lambda:us-east-1:111122223333:function:CFN36-RedshiftDataApi-AIDACKCEVSQ6C2EXAMPLE':
        async payload => await redshiftDataApiMock(payload as RedshiftDataApiParams),
    };
    const runOptions = {
      definition,
      resourceContext: {
        invoke: async (resourceName: string, payload: unknown) => {
          const handler = mockResources[resourceName];
          if (!handler) {
            throw new Error(`Unknown mock resource: ${resourceName}`);
          }
          return await handler(payload);
        },
      },
    };
    const mockedSetTimeout = vitest.mocked(setTimeout);
    mockedSetTimeout.mockImplementation(fn => {
      fn();
      type Timeout = ReturnType<typeof setTimeout>;
      return 1 as unknown as Timeout;
    });
    // When
    const result = await run(runOptions, input);
    // Then
    expect(redshiftOperationsMock).toHaveBeenNthCalledWith(1, {
      input: {
        operation: 'status',
        redshift_cluster_id: 'cfn36-redshiftcluster-AKIAI44QH8DHBEXAMPLE',
      },
    });
    expect(redshiftOperationsMock).toHaveBeenNthCalledWith(2, {
      input: {
        operation: 'resume',
        redshift_cluster_id: 'cfn36-redshiftcluster-AKIAI44QH8DHBEXAMPLE',
      },
    });
    expect(redshiftOperationsMock).toHaveBeenNthCalledWith(3, {
      input: {
        operation: 'status',
        redshift_cluster_id: 'cfn36-redshiftcluster-AKIAI44QH8DHBEXAMPLE',
      },
    });
    expect(Object.keys(actionsMock).sort()).toStrictEqual(actions);
    expect(actionsMock.build_database).toBeCalledTimes(3);
    expect(actionsMock.load_customer_address).toBeCalledTimes(4);
    expect(actionsMock.load_item).toBeCalledTimes(4);
    expect(actionsMock.load_sales_fact).toBeCalledTimes(3);
    expect(actionsMock.validate_sales_metric).toBeCalledTimes(3);
    const baseApiOperation = {
      redshift_cluster_id: 'cfn36-redshiftcluster-AKIAI44QH8DHBEXAMPLE',
      redshift_database: 'dev',
      redshift_schema: 'tpcds',
      redshift_user: 'awsuser',
      sql_statement: expect.any(Array),
    };
    const customApiOperationParams: Partial<Record<ActionName, { snapshot_date: string }>> = {
      load_sales_fact: {
        snapshot_date: '2003-01-02',
      },
      validate_sales_metric: {
        snapshot_date: '2003-01-02',
      },
    };
    // For each action
    actions.forEach(action => {
      expect(actionsMock[action]).toHaveBeenNthCalledWith(1, {
        // execute operation
        input: {
          action,
          ...baseApiOperation,
          ...customApiOperationParams[action],
        },
      });
      expect(actionsMock[action]).toHaveBeenNthCalledWith(2, {
        // check status
        input: {
          action,
          ...baseApiOperation,
          ...customApiOperationParams[action],
        },
      });
      expect(actionsMock[action]).toHaveBeenNthCalledWith(3, {
        input: {
          action,
          ...baseApiOperation,
          ...customApiOperationParams[action],
        },
        status: 'PENDING',
      });
    });
    expect(result).toStrictEqual({
      input: {
        redshift_cluster_id: 'cfn36-redshiftcluster-AKIAI44QH8DHBEXAMPLE',
        operation: 'status',
      },
      clusterStatus: 'paused',
    });
  });
});
