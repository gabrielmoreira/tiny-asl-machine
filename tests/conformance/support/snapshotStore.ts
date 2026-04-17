import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDefaultDeploymentConfigPath,
  type DeploymentConfigFile,
} from '../../../scripts/deployment-config.ts';
import type { ConformanceCase, TestResult } from './types';

type SnapshotRunner = 'local' | 'aws';

type CaseSnapshot = {
  runner: SnapshotRunner;
  id: string;
  title: string;
  group: string;
  hash: string;
  definition: ConformanceCase['definition'];
  input: ConformanceCase['input'];
  result: TestResult;
};

type SnapshotDeploymentConfig = Pick<DeploymentConfigFile, 'snapshotRedactingTags'>;

const SNAPSHOT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'cases', '.snapshots');

export async function readCaseSnapshot(
  runner: SnapshotRunner,
  testCase: Pick<ConformanceCase, 'group' | 'id' | 'definition' | 'input'>
): Promise<CaseSnapshot | null> {
  const path = getCaseSnapshotPath(runner, testCase);
  const expectedHash = buildDefinitionInputHash(testCase);

  try {
    const raw = await readFile(path, 'utf8');
    const restored = await restoreSnapshotText(raw);
    const snapshot = JSON.parse(restored) as CaseSnapshot;
    return snapshot.hash === expectedHash ? snapshot : null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeCaseSnapshot(
  runner: SnapshotRunner,
  testCase: ConformanceCase,
  result: TestResult
): Promise<void> {
  const path = getCaseSnapshotPath(runner, testCase);
  const snapshot: CaseSnapshot = {
    runner,
    id: testCase.id,
    title: testCase.title,
    group: testCase.group,
    hash: buildDefinitionInputHash(testCase),
    definition: testCase.definition,
    input: testCase.input,
    result,
  };

  await mkdir(dirname(path), { recursive: true });
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(path, await redactSnapshotText(serialized));
}

export function getCaseSnapshotPath(
  runner: SnapshotRunner,
  testCase: Pick<ConformanceCase, 'group' | 'id' | 'definition' | 'input'>
): string {
  const safeName = sanitizeSnapshotName(`${testCase.group}-${testCase.id}`);
  return join(SNAPSHOT_ROOT, runner, `${safeName}.json`);
}

function buildDefinitionInputHash(testCase: Pick<ConformanceCase, 'definition' | 'input'>): string {
  return createHash('sha256')
    .update(JSON.stringify({ definition: testCase.definition, input: testCase.input }))
    .digest('hex');
}

function sanitizeSnapshotName(name: string): string {
  return name
    .replace(/[^0-9A-Za-z._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function appendExecutionLog(
  runner: SnapshotRunner,
  event: 'HIT' | 'MISS',
  testCase: Pick<ConformanceCase, 'group' | 'id' | 'definition' | 'input'>
): Promise<void> {
  const hash = buildDefinitionInputHash(testCase);
  const logPath = join(SNAPSHOT_ROOT, runner, '__last_run.log');
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(
    logPath,
    `${new Date().toISOString()} ${event} ${testCase.group}/${testCase.id} ${hash}\n`
  );
}

async function redactSnapshotText(text: string) {
  const tags = await readSnapshotRedactingTags();
  if (!tags) {
    return text;
  }

  let redacted = text;
  for (const [key, value] of Object.entries(sortTagsByValueLength(tags))) {
    redacted = redacted.split(value).join(`<REDACTED_VAR:${key}>`);
  }

  return redacted;
}

async function restoreSnapshotText(text: string) {
  const tags = await readSnapshotRedactingTags();
  if (!tags) {
    return text;
  }

  let restored = text;
  for (const [key, value] of Object.entries(tags) as Array<[string, string]>) {
    restored = restored.split(`<REDACTED_VAR:${key}>`).join(value);
  }

  return restored;
}

async function readSnapshotRedactingTags() {
  const deploymentConfig = await readDeploymentConfig();
  return deploymentConfig?.snapshotRedactingTags;
}

async function readDeploymentConfig(): Promise<SnapshotDeploymentConfig | null> {
  try {
    const raw = await readFile(getDefaultDeploymentConfigPath(), 'utf8');
    return JSON.parse(raw) as SnapshotDeploymentConfig;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function sortTagsByValueLength(tags: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(tags).sort(([, left], [, right]) => right.length - left.length)
  );
}
