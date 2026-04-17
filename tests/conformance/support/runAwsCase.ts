import type { ConformanceCase, TestResult } from './types';
import { getDeploymentConfig } from './deploymentConfig';
import {
  buildAwsName,
  createStateMachine,
  deleteStateMachine,
  getDeploymentStateMachineTagsFromEnv,
  getExecutionHistory,
  type AwsDescribeExecutionResult,
  startExecutionWithRetry,
  validateStateMachineDefinition,
  waitForExecutionCompletion,
} from './awsStepFunctionsSdk';

const AWS_ROLE_ARN_ENV = 'AWS_SFN_ROLE_ARN';

export function hasAwsCaseConfig() {
  return Boolean(getDeploymentConfig().aws.stepFunctionsRoleArn);
}

export function getAwsCaseSkipReason() {
  if (!getDeploymentConfig().aws.stepFunctionsRoleArn) {
    return `Set ${AWS_ROLE_ARN_ENV} to run AWS conformance tests.`;
  }

  return null;
}

export async function runAwsCase(testCase: ConformanceCase): Promise<TestResult> {
  const roleArn = getDeploymentConfig().aws.stepFunctionsRoleArn;
  if (!roleArn) {
    throw new Error(getAwsCaseSkipReason() ?? `${AWS_ROLE_ARN_ENV} is required.`);
  }

  const definition = JSON.stringify(testCase.definition);
  const input = JSON.stringify(testCase.input);
  const validation = await validateStateMachineDefinition(definition);

  if (validation.result !== 'OK') {
    return {
      error: 'VALIDATION_FAILED',
      cause:
        validation.diagnostics
          ?.map(diagnostic => diagnostic.message ?? diagnostic.code ?? 'Unknown validation error')
          .join('; ') ?? 'Unknown validation error',
    };
  }

  let stateMachineArn: string | undefined;

  try {
    stateMachineArn = await createStateMachine(
      definition,
      roleArn,
      buildAwsName(`tam-conf-${testCase.group}-${testCase.id}`),
      getDeploymentStateMachineTagsFromEnv()
    );
    const executionArn = await startExecutionWithRetry(
      stateMachineArn,
      buildAwsName(`exec-conf-${testCase.group}-${testCase.id}`),
      input
    );
    const execution = await waitForExecutionCompletion(executionArn);
    return await normalizeExecutionResult(testCase, execution);
  } finally {
    if (stateMachineArn) {
      await bestEffortDelete(stateMachineArn);
    }
  }
}

async function normalizeExecutionResult(
  testCase: ConformanceCase,
  execution: AwsDescribeExecutionResult
): Promise<TestResult> {
  const meta =
    testCase.awsObservation?.includeExecutionHistory && execution.executionArn
      ? { history: await getExecutionHistory(execution.executionArn, true) }
      : undefined;

  if (execution.status === 'SUCCEEDED') {
    return {
      output: parseJsonValue(execution.output ?? 'null', 'describe-execution output'),
      ...(meta ? { meta } : {}),
    };
  }

  return {
    error: execution.error ?? execution.status,
    cause: execution.cause ?? execution.status,
    ...(meta ? { meta } : {}),
  };
}

async function bestEffortDelete(stateMachineArn: string) {
  try {
    await deleteStateMachine(stateMachineArn);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to delete state machine ${stateMachineArn}: ${message}`);
  }
}

function parseJsonValue(raw: string, label: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${label} as JSON: ${reason}`);
  }
}
