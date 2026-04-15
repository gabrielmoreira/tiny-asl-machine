import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCaseSnapshotPath, readCaseSnapshot, writeCaseSnapshot } from './snapshotStore';
import type { ConformanceCase } from './types';

const fakeAccountId = '123456789012';
const fakeRegion = 'example-region-1';
const fakeWorkspaceHash = 'workspace-hash-123';
const deploymentConfigPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.local',
  'aws',
  'deployment-config.json'
);

let originalDeploymentConfigRaw: string | null = null;

beforeEach(async () => {
  try {
    originalDeploymentConfigRaw = await readFile(deploymentConfigPath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      originalDeploymentConfigRaw = null;
      return;
    }

    throw error;
  }
});

const snapshotTestCase: ConformanceCase = {
  id: 'snapshot-redaction-contract',
  title: 'snapshot redaction contract',
  group: 'Snapshot.Store',
  definition: {
    StartAt: 'PassThrough',
    States: {
      PassThrough: {
        Type: 'Pass',
        End: true,
      },
    },
  },
  input: {
    text: `ACCOUNT=${fakeAccountId} REGION=${fakeRegion} WORKSPACE=${fakeWorkspaceHash}`,
  },
  expected: () => undefined,
};

function buildHash() {
  return createHash('sha256')
    .update(
      JSON.stringify({ definition: snapshotTestCase.definition, input: snapshotTestCase.input })
    )
    .digest('hex');
}

afterEach(async () => {
  if (originalDeploymentConfigRaw === null) {
    await rm(deploymentConfigPath, { force: true });
  } else {
    await mkdir(dirname(deploymentConfigPath), { recursive: true });
    await writeFile(deploymentConfigPath, originalDeploymentConfigRaw);
  }

  await rm(getCaseSnapshotPath('local', snapshotTestCase), { force: true });
});

describe('snapshotStore redaction contract', () => {
  it('writes snapshots with deployment-config placeholder redaction applied', async () => {
    await mkdir(dirname(deploymentConfigPath), { recursive: true });
    await writeFile(
      deploymentConfigPath,
      JSON.stringify(
        {
          snapshotRedactingTags: {
            ACCOUNT_ID: fakeAccountId,
            REGION: fakeRegion,
            WORKSPACE_HASH: fakeWorkspaceHash,
          },
        },
        null,
        2
      )
    );

    await writeCaseSnapshot('local', snapshotTestCase, {
      output: {
        account: fakeAccountId,
        region: fakeRegion,
        workspace: fakeWorkspaceHash,
      },
    });

    const raw = await readFile(getCaseSnapshotPath('local', snapshotTestCase), 'utf8');
    expect(raw).toContain('<REDACTED_VAR:ACCOUNT_ID>');
    expect(raw).toContain('<REDACTED_VAR:REGION>');
    expect(raw).toContain('<REDACTED_VAR:WORKSPACE_HASH>');
    expect(raw).not.toContain(fakeAccountId);
    expect(raw).not.toContain(fakeRegion);
    expect(raw).not.toContain(fakeWorkspaceHash);
  });

  it('restores redacted placeholders from disk using deployment config before parsing', async () => {
    await mkdir(dirname(deploymentConfigPath), { recursive: true });
    await writeFile(
      deploymentConfigPath,
      JSON.stringify(
        {
          snapshotRedactingTags: {
            ACCOUNT_ID: fakeAccountId,
            REGION: fakeRegion,
          },
        },
        null,
        2
      )
    );

    await mkdir(dirname(getCaseSnapshotPath('local', snapshotTestCase)), { recursive: true });
    await writeFile(
      getCaseSnapshotPath('local', snapshotTestCase),
      JSON.stringify(
        {
          runner: 'local',
          id: snapshotTestCase.id,
          title: snapshotTestCase.title,
          group: snapshotTestCase.group,
          hash: buildHash(),
          definition: snapshotTestCase.definition,
          input: snapshotTestCase.input,
          result: {
            output: {
              arn: `arn:aws:states:<REDACTED_VAR:REGION>:<REDACTED_VAR:ACCOUNT_ID>:stateMachine:demo`,
            },
          },
        },
        null,
        2
      )
    );

    const snapshot = await readCaseSnapshot('local', snapshotTestCase);
    expect(snapshot?.result.output).toStrictEqual({
      arn: `arn:aws:states:${fakeRegion}:${fakeAccountId}:stateMachine:demo`,
    });
  });
});
