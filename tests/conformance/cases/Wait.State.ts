import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Wait.State';
const sourceFile = 'src/states/index.ts';

type RecordedWaitProbe = {
  recordedMs: number[];
};

type WaitVariant =
  | { Seconds: number }
  | { SecondsPath: string }
  | { Timestamp: string }
  | { TimestampPath: string };

function buildWaitDefinition(waitState: WaitVariant): ConformanceCase['definition'] {
  return {
    StartAt: 'WaitHere',
    States: {
      WaitHere: {
        Type: 'Wait',
        ...waitState,
        End: true,
      },
    },
  };
}

function expectOutput(output: unknown) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectOutputAndRecordedDelay(
  output: unknown,
  expectedDelayMs: number,
  probe: RecordedWaitProbe
) {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
    expect(probe.recordedMs).toStrictEqual([expectedDelayMs]);
  };
}

function createInstantLocalWaitRuntime(
  now = '2025-01-01T00:00:00.000Z'
): NonNullable<ConformanceCase['setupLocalRuntime']> {
  return () => ({
    now: () => now,
    sleep: async () => {},
  });
}

function createRecordedLocalWaitRuntime(now: string): {
  probe: RecordedWaitProbe;
  setupLocalRuntime: NonNullable<ConformanceCase['setupLocalRuntime']>;
} {
  const probe: RecordedWaitProbe = { recordedMs: [] };

  return {
    probe,
    setupLocalRuntime: () => {
      probe.recordedMs = [];

      return {
        now: () => now,
        sleep: async (ms: number) => {
          probe.recordedMs.push(ms);
        },
      };
    },
  };
}

const timestampLiteralWait = createRecordedLocalWaitRuntime('2025-01-01T00:00:00.000Z');
const timestampPathWait = createRecordedLocalWaitRuntime('2025-01-01T00:00:05.000Z');
const pastTimestampWait = createRecordedLocalWaitRuntime('2025-01-01T00:00:10.000Z');

export const waitStateCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-seconds-literal',
    title: 'waits for a literal number of seconds and then returns the original input',
    group,
    tags: ['happy_path', 'seconds'],
    definition: buildWaitDefinition({ Seconds: 1 }),
    input: { orderId: 'A-100', status: 'QUEUED' },
    expected: expectOutput({ orderId: 'A-100', status: 'QUEUED' }),
    setupLocalRuntime: createInstantLocalWaitRuntime(),
    source: {
      file: sourceFile,
      notes:
        'Covers literal Seconds delay calculation together with Wait-state pass-through semantics.',
    },
  }),
  customDefinitionCase({
    id: '002-seconds-path',
    title: 'reads SecondsPath from input and resumes with the same payload',
    group,
    tags: ['happy_path', 'seconds_path'],
    definition: buildWaitDefinition({ SecondsPath: '$.waitSeconds' }),
    input: {
      waitSeconds: 1,
      job: { id: 'job-7', ready: true },
    },
    expected: expectOutput({
      waitSeconds: 1,
      job: { id: 'job-7', ready: true },
    }),
    setupLocalRuntime: createInstantLocalWaitRuntime(),
    source: {
      file: sourceFile,
      notes:
        'Exercises path-based wait selection without relying on wall-clock time in local execution.',
    },
  }),
  customDefinitionCase({
    id: '003-timestamp-literal',
    title: 'waits until a literal timestamp using the runtime clock',
    group,
    tags: ['happy_path', 'timestamp'],
    definition: buildWaitDefinition({ Timestamp: '2025-01-01T00:00:10.000Z' }),
    input: { ticketId: 'T-100' },
    expected: expectOutputAndRecordedDelay(
      { ticketId: 'T-100' },
      10_000,
      timestampLiteralWait.probe
    ),
    setupLocalRuntime: timestampLiteralWait.setupLocalRuntime,
    awsExecutable: false,
    skipReason:
      'Retained as deterministic local coverage until absolute Timestamp wait behavior is captured directly against AWS without introducing clock-sensitive flakiness.',
    source: {
      file: sourceFile,
      notes: 'Directly characterizes Timestamp delay computation from runtime.now().',
    },
  }),
  customDefinitionCase({
    id: '004-timestamp-path',
    title: 'waits until the timestamp selected by TimestampPath',
    group,
    tags: ['happy_path', 'timestamp_path'],
    definition: buildWaitDefinition({ TimestampPath: '$.resumeAt' }),
    input: {
      resumeAt: '2025-01-01T00:00:20.000Z',
      workflow: 'reconcile',
    },
    expected: expectOutputAndRecordedDelay(
      {
        resumeAt: '2025-01-01T00:00:20.000Z',
        workflow: 'reconcile',
      },
      15_000,
      timestampPathWait.probe
    ),
    setupLocalRuntime: timestampPathWait.setupLocalRuntime,
    awsExecutable: false,
    skipReason:
      'TimestampPath waiting is covered deterministically locally first; enabling AWS execution should follow a direct observation of absolute-time behavior in the harness.',
    source: {
      file: sourceFile,
      notes: 'Exercises path lookup plus non-negative timestamp delay computation.',
    },
  }),
  customDefinitionCase({
    id: '005-past-timestamp-clamps-to-zero',
    title: 'does not wait when the target timestamp is already in the past',
    group,
    tags: ['boundary', 'timestamp'],
    definition: buildWaitDefinition({ Timestamp: '2025-01-01T00:00:05.000Z' }),
    input: { checkpoint: 'already-open' },
    expected: expectOutputAndRecordedDelay(
      { checkpoint: 'already-open' },
      0,
      pastTimestampWait.probe
    ),
    setupLocalRuntime: pastTimestampWait.setupLocalRuntime,
    awsExecutable: false,
    skipReason:
      'This semantic boundary case is kept local until AWS absolute Timestamp handling is observed in the conformance harness with a stable clock reference.',
    source: {
      file: sourceFile,
      notes:
        'Distinguishes normal zero-delay timestamp semantics from malformed timestamp-value behavior.',
    },
  }),
  customDefinitionCase({
    id: '006-input-pass-through',
    title: 'preserves nested input structure after a wait completes',
    group,
    tags: ['happy_path', 'pass_through'],
    definition: buildWaitDefinition({ Seconds: 1 }),
    input: {
      user: { id: 'user-42', flags: ['beta', 'notify'] },
      counters: { retries: 0, attempts: 3 },
      approved: false,
    },
    expected: expectOutput({
      user: { id: 'user-42', flags: ['beta', 'notify'] },
      counters: { retries: 0, attempts: 3 },
      approved: false,
    }),
    setupLocalRuntime: createInstantLocalWaitRuntime(),
    source: {
      file: sourceFile,
      notes:
        'Targets the Wait executor returning inputData through processStateOutput after the delay.',
    },
  }),
];
