import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import {
  CreateStateMachineCommand,
  DeleteStateMachineCommand,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
  ValidateStateMachineDefinitionCommand,
  type HistoryEvent,
} from '@aws-sdk/client-sfn';

import { getDeploymentStateMachineTags } from './deploymentConfig';

const CREATE_STATE_MACHINE_DELAY_MS = 1_000;
const START_RETRY_DELAY_MS = 1_000;
const POLL_DELAY_MS = 1_000;
const MAX_START_ATTEMPTS = 5;
const MAX_POLL_ATTEMPTS = 120;

let client: SFNClient | undefined;

type AwsValidationResult = {
  result: 'OK' | 'FAIL';
  diagnostics?: Array<{
    code?: string;
    location?: string;
    message?: string;
    severity?: string;
  }>;
};

export type AwsDescribeExecutionResult = {
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  output?: string;
  error?: string;
  cause?: string;
  executionArn?: string;
};

export type AwsExecutionHistoryEvent = {
  id?: number;
  type?: string;
  previousEventId?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
};

export type AwsResourceTag = {
  key: string;
  value: string;
};

function getClient() {
  client ??= new SFNClient({});
  return client;
}

export async function validateStateMachineDefinition(
  definition: string
): Promise<AwsValidationResult> {
  const response = await getClient().send(
    new ValidateStateMachineDefinitionCommand({ definition })
  );
  return {
    result: (response.result ?? 'FAIL') as 'OK' | 'FAIL',
    diagnostics: response.diagnostics?.map(diagnostic => ({
      code: diagnostic.code,
      location: diagnostic.location,
      message: diagnostic.message,
      severity: diagnostic.severity,
    })),
  };
}

export async function createStateMachine(
  definition: string,
  roleArn: string,
  name: string,
  tags: AwsResourceTag[] = []
): Promise<string> {
  await delay(CREATE_STATE_MACHINE_DELAY_MS);

  const response = await getClient().send(
    new CreateStateMachineCommand({
      definition,
      roleArn,
      name,
      type: 'STANDARD',
      ...(tags.length > 0 ? { tags } : {}),
    })
  );

  if (!response.stateMachineArn) {
    throw new Error('CreateStateMachine did not return a stateMachineArn.');
  }

  return response.stateMachineArn;
}

export async function startExecutionWithRetry(
  stateMachineArn: string,
  executionName: string,
  input: string
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_START_ATTEMPTS; attempt++) {
    try {
      const response = await getClient().send(
        new StartExecutionCommand({
          stateMachineArn,
          name: executionName,
          input,
        })
      );

      if (!response.executionArn) {
        throw new Error('StartExecution did not return an executionArn.');
      }

      return response.executionArn;
    } catch (error) {
      if (attempt === MAX_START_ATTEMPTS || !isEventuallyConsistentStartError(error)) {
        throw error;
      }

      await delay(START_RETRY_DELAY_MS);
    }
  }

  throw new Error('Execution start retry loop exhausted unexpectedly.');
}

export async function waitForExecutionCompletion(
  executionArn: string
): Promise<AwsDescribeExecutionResult> {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await getClient().send(
      new DescribeExecutionCommand({
        executionArn,
      })
    );

    const execution: AwsDescribeExecutionResult = {
      status: (response.status ?? 'FAILED') as AwsDescribeExecutionResult['status'],
      output: response.output,
      error: response.error,
      cause: response.cause,
      executionArn,
    };

    if (execution.status !== 'RUNNING') {
      return execution;
    }

    await delay(POLL_DELAY_MS);
  }

  throw new Error(`Execution ${executionArn} did not finish within the polling window.`);
}
export async function getExecutionHistory(
  executionArn: string,
  includeExecutionData = true
): Promise<AwsExecutionHistoryEvent[]> {
  const response = await getClient().send(
    new GetExecutionHistoryCommand({
      executionArn,
      includeExecutionData,
    })
  );

  return (response.events ?? []).map(event => mapHistoryEvent(event));
}

export async function deleteStateMachine(stateMachineArn: string): Promise<void> {
  await getClient().send(
    new DeleteStateMachineCommand({
      stateMachineArn,
    })
  );
}

export function buildAwsName(prefix: string) {
  const sanitizedPrefix = sanitizeAwsName(prefix);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const maxPrefixLength = 80 - suffix.length - 1;
  const trimmedPrefix = sanitizedPrefix.slice(0, Math.max(1, maxPrefixLength));
  return `${trimmedPrefix}-${suffix}`;
}

export function getDeploymentStateMachineTagsFromEnv(): AwsResourceTag[] {
  return getDeploymentStateMachineTags();
}

function sanitizeAwsName(name: string) {
  const sanitized = name
    .replace(/[^0-9A-Za-z-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized.length > 0 ? sanitized : 'tam';
}
function isEventuallyConsistentStartError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /StateMachineDoesNotExist|state machine .*does not exist|ExecutionRoleArnNotValid|not authorized to assume the provided role/i.test(
    error.message
  );
}

function mapHistoryEvent(event: HistoryEvent): AwsExecutionHistoryEvent {
  return {
    id: event.id,
    type: event.type,
    previousEventId: event.previousEventId,
    timestamp: event.timestamp?.toISOString(),
    details: extractEventDetails(event),
  };
}

function extractEventDetails(event: HistoryEvent): Record<string, unknown> | undefined {
  const entries = Object.entries(event).filter(([key, value]) => {
    return (
      key.endsWith('EventDetails') &&
      typeof value !== 'undefined' &&
      value !== null &&
      typeof value === 'object'
    );
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(([key, value]) => [key, value as Record<string, unknown>]));
}
