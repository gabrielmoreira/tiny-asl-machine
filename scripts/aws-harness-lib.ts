/* eslint-env node */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudWatchLogsClient, DeleteLogGroupCommand } from '@aws-sdk/client-cloudwatch-logs';
import {
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  DetachRolePolicyCommand,
  GetRoleCommand,
  IAMClient,
  ListAttachedRolePoliciesCommand,
  ListRolePoliciesCommand,
} from '@aws-sdk/client-iam';
import {
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  ListTagsCommand,
} from '@aws-sdk/client-lambda';
import {
  DeleteStateMachineCommand,
  ListStateMachinesCommand,
  ListTagsForResourceCommand,
  SFNClient,
} from '@aws-sdk/client-sfn';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import yazl from 'yazl';
type ResolvedValue = string | undefined;

type RegionSources = {
  envAwsRegion?: string;
  envAwsDefaultRegion?: string;
  existingRegion?: string;
  sharedConfigRegion?: string;
  sharedCredentialsRegion?: string;
  awsCliProfileRegion?: string;
  awsCliRegion?: string;
};

type AccountSources = {
  stsAccountId?: string;
  existingAccountId?: string;
  awsCliAccountId?: string;
};

type WorkspaceHashSources = {
  existingWorkspaceHash?: string;
  computedWorkspaceHash: string;
};

function normalizeResolvedValue(value: unknown): ResolvedValue {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.toLowerCase() === 'unknown') {
    return undefined;
  }

  return normalized;
}

export function resolveRegion({
  envAwsRegion,
  envAwsDefaultRegion,
  existingRegion,
  sharedConfigRegion,
  sharedCredentialsRegion,
  awsCliProfileRegion,
  awsCliRegion,
}: RegionSources): string {
  return (
    normalizeResolvedValue(envAwsRegion) ??
    normalizeResolvedValue(envAwsDefaultRegion) ??
    normalizeResolvedValue(existingRegion) ??
    normalizeResolvedValue(sharedConfigRegion) ??
    normalizeResolvedValue(sharedCredentialsRegion) ??
    normalizeResolvedValue(awsCliProfileRegion) ??
    normalizeResolvedValue(awsCliRegion) ??
    'unknown'
  );
}

export function resolveAccountId({
  stsAccountId,
  existingAccountId,
  awsCliAccountId,
}: AccountSources): string {
  return (
    normalizeResolvedValue(stsAccountId) ??
    normalizeResolvedValue(existingAccountId) ??
    normalizeResolvedValue(awsCliAccountId) ??
    'unknown'
  );
}

export function resolveWorkspaceHash({
  existingWorkspaceHash,
  computedWorkspaceHash,
}: WorkspaceHashSources): string {
  return normalizeResolvedValue(existingWorkspaceHash) ?? computedWorkspaceHash;
}

const { ZipFile } = yazl;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const awsLocalDir = resolve(repoRoot, '.local', 'aws');
const distDir = resolve(awsLocalDir, 'dist');
const deploymentConfigPath = resolve(awsLocalDir, 'deployment-config.json');
const lambdaEntryPath = resolve(scriptDir, 'aws-lambda', 'index.mjs');
const lambdaZipPath = resolve(distDir, 'lambda-fixture.zip');
const stsClient = new STSClient({});
const iamClient = new IAMClient({});
const lambdaClient = new LambdaClient({});
const logsClient = new CloudWatchLogsClient({});
const sfnClient = new SFNClient({});

export type HarnessTags = Record<string, string>;
export type HarnessEnvironment = Record<string, string>;

export type HarnessConfig = {
  accountId: string;
  region: string;
  stackName: string;
  workspaceHash: string;
  names: {
    lambdaFunctionName: string;
    lambdaRoleName: string;
    stepFunctionsRoleName: string;
  };
  tags: HarnessTags;
  environment: HarnessEnvironment;
};

export type HarnessTagFilters = {
  managedBy?: string;
  workspace?: string;
};

export type DeploymentConfig = {
  version: number;
  updatedAt: string;
  accountId: string;
  region: string;
  stackName: string;
  workspaceHash: string;
  tags: HarnessTags;
  resourceNames: HarnessConfig['names'];
  resources: {
    lambdaFunctionArn?: string;
    lambdaRoleArn?: string;
    stepFunctionsRoleArn?: string;
  };
  cloudFormation: {
    managed: true;
    stackStatus?: string;
    templatePath: string;
  };
  artifacts: {
    lambdaZip: {
      bucketName?: string;
      objectKey?: string;
    };
    itemReader?: {
      bucketName?: string;
      jsonItemsPointerKey?: string;
      listNonePrefix?: string;
      loadAndFlattenPrefix?: string;
      csvFirstRowKey?: string;
      csvPipeKey?: string;
      csvGivenKey?: string;
      jsonlKey?: string;
    };
  };
  environment: HarnessEnvironment;
  snapshotRedactingTags: Record<string, string>;
};

const TAG_KEYS = {
  managedBy: 'tiny-asl-machine:managed-by',
  workspace: 'tiny-asl-machine:workspace',
  stack: 'tiny-asl-machine:stack',
  repo: 'tiny-asl-machine:repo',
} as const;

export async function getHarnessConfig(): Promise<HarnessConfig> {
  const existingDeploymentConfig = await readDeploymentConfig();
  const callerIdentity = await getCallerIdentityIfAvailable();
  const profileName = getAwsProfileName();
  const computedWorkspaceHash = createHash('sha1').update(repoRoot).digest('hex').slice(0, 10);
  const workspaceHash = resolveWorkspaceHash({
    existingWorkspaceHash: existingDeploymentConfig?.workspaceHash,
    computedWorkspaceHash,
  });
  const region = resolveRegion({
    envAwsRegion: process.env.AWS_REGION,
    envAwsDefaultRegion: process.env.AWS_DEFAULT_REGION,
    existingRegion: existingDeploymentConfig?.region,
    sharedConfigRegion: readAwsSharedConfigRegion(profileName),
    sharedCredentialsRegion: readAwsSharedCredentialsRegion(profileName),
    awsCliProfileRegion: readAwsCliConfiguredRegion(profileName),
    awsCliRegion: readAwsCliConfiguredRegion(),
  });
  const accountId = resolveAccountId({
    stsAccountId: callerIdentity?.Account,
    existingAccountId: existingDeploymentConfig?.accountId,
    awsCliAccountId: readAwsCliAccountId(),
  });
  const stackName = `tiny-asl-machine-aws-${workspaceHash}`;
  const lambdaFunctionName = `${stackName}-lambda-fixture`;
  const lambdaRoleName = `${stackName}-lambda-role`;
  const stepFunctionsRoleName = `${stackName}-sfn-role`;
  const tags: HarnessTags = {
    [TAG_KEYS.managedBy]: 'aws-conformance-harness',
    [TAG_KEYS.workspace]: workspaceHash,
    [TAG_KEYS.stack]: stackName,
    [TAG_KEYS.repo]: 'tiny-asl-machine',
  };

  return {
    accountId,
    region,
    stackName,
    workspaceHash,
    names: {
      lambdaFunctionName,
      lambdaRoleName,
      stepFunctionsRoleName,
    },
    tags,
    environment: {
      AWS_TAM_TAG_MANAGED_BY: tags[TAG_KEYS.managedBy],
      AWS_TAM_TAG_WORKSPACE: tags[TAG_KEYS.workspace],
      AWS_TAM_TAG_STACK: tags[TAG_KEYS.stack],
      AWS_TAM_TAG_REPO: tags[TAG_KEYS.repo],
      AWS_REGION: region,
      AWS_DEFAULT_REGION: region,
    },
  };
}

export function getHarnessTagFilters(
  env: NodeJS.ProcessEnv | HarnessEnvironment
): HarnessTagFilters {
  return {
    managedBy: env.AWS_TAM_TAG_MANAGED_BY,
    workspace: env.AWS_TAM_TAG_WORKSPACE,
  };
}

export async function readDeploymentConfig(): Promise<DeploymentConfig | null> {
  try {
    return JSON.parse(await readFile(deploymentConfigPath, 'utf8')) as DeploymentConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeDeploymentConfig(deploymentConfig: DeploymentConfig): Promise<void> {
  await mkdir(dirname(deploymentConfigPath), { recursive: true });
  await writeFile(deploymentConfigPath, `${JSON.stringify(deploymentConfig, null, 2)}\n`, 'utf8');
}

export async function removeDeploymentConfig(): Promise<void> {
  await rm(deploymentConfigPath, { force: true });
}

export async function ensureLambdaBundle(): Promise<string> {
  await mkdir(dirname(lambdaZipPath), { recursive: true });
  await createZipArchive(lambdaZipPath, [{ sourcePath: lambdaEntryPath, zipPath: 'index.mjs' }]);
  return lambdaZipPath;
}

export async function cleanupLegacyHarnessResources(config: HarnessConfig): Promise<void> {
  const filters = getHarnessTagFilters(config.environment);
  await deleteLambdaFunctionIfTagged(config.names.lambdaFunctionName, filters);
  await deleteLambdaLogGroup(config.names.lambdaFunctionName);
  await deleteRoleIfTagged(config.names.stepFunctionsRoleName, filters);
  await deleteRoleIfTagged(config.names.lambdaRoleName, filters);
}

export async function deleteTaggedStateMachines(
  filters: HarnessTagFilters
): Promise<Array<{ name?: string; arn: string }>> {
  const deleted: Array<{ name?: string; arn: string }> = [];
  let nextToken: string | undefined;

  do {
    const page = await sfnClient.send(new ListStateMachinesCommand({ nextToken, maxResults: 100 }));
    nextToken = page.nextToken;

    for (const stateMachine of page.stateMachines ?? []) {
      if (!stateMachine.stateMachineArn) {
        continue;
      }

      let tagMap: Record<string, string>;
      try {
        const tags = await sfnClient.send(
          new ListTagsForResourceCommand({
            resourceArn: stateMachine.stateMachineArn,
          })
        );
        tagMap = Object.fromEntries((tags.tags ?? []).map(tag => [tag.key ?? '', tag.value ?? '']));
      } catch (error) {
        if (isStepFunctionsNotFound(error)) {
          continue;
        }

        throw error;
      }

      if (!tagsMatchHarness(tagMap, filters)) {
        continue;
      }

      try {
        await sfnClient.send(
          new DeleteStateMachineCommand({
            stateMachineArn: stateMachine.stateMachineArn,
          })
        );
      } catch (error) {
        if (isStepFunctionsNotFound(error)) {
          continue;
        }

        throw error;
      }

      deleted.push({
        name: stateMachine.name,
        arn: stateMachine.stateMachineArn,
      });
    }
  } while (nextToken);

  return deleted;
}

export async function deleteLambdaLogGroup(functionName: string): Promise<boolean> {
  const logGroupName = `/aws/lambda/${functionName}`;
  try {
    await logsClient.send(new DeleteLogGroupCommand({ logGroupName }));
    return true;
  } catch (error) {
    if (isLogsNotFound(error)) {
      return false;
    }

    throw error;
  }
}

export function buildDeploymentConfig({
  config,
  lambdaRoleArn,
  lambdaFunctionArn,
  stepFunctionsRoleArn,
  artifactBucketName,
  artifactObjectKey,
  stackStatus,
  itemReaderArtifacts,
}: {
  config: HarnessConfig;
  lambdaRoleArn?: string;
  lambdaFunctionArn?: string;
  stepFunctionsRoleArn?: string;
  artifactBucketName?: string;
  artifactObjectKey?: string;
  stackStatus?: string;
  itemReaderArtifacts?: {
    bucketName?: string;
    jsonItemsPointerKey?: string;
    listNonePrefix?: string;
    loadAndFlattenPrefix?: string;
    csvFirstRowKey?: string;
    csvPipeKey?: string;
    csvGivenKey?: string;
    jsonlKey?: string;
  };
}): DeploymentConfig {
  const environment = Object.fromEntries(
    Object.entries({
      ...config.environment,
      AWS_SFN_ROLE_ARN: stepFunctionsRoleArn,
      AWS_LAMBDA_FIXTURE_FUNCTION_NAME: config.names.lambdaFunctionName,
      AWS_LAMBDA_FIXTURE_ARN: lambdaFunctionArn,
      AWS_LAMBDA_FIXTURE_ROLE_ARN: lambdaRoleArn,
    }).filter(([, value]) => typeof value !== 'undefined')
  ) as HarnessEnvironment;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    accountId: config.accountId,
    region: config.region,
    stackName: config.stackName,
    workspaceHash: config.workspaceHash,
    tags: config.tags,
    resourceNames: {
      lambdaFunctionName: config.names.lambdaFunctionName,
      lambdaRoleName: config.names.lambdaRoleName,
      stepFunctionsRoleName: config.names.stepFunctionsRoleName,
    },
    resources: {
      lambdaFunctionArn,
      lambdaRoleArn,
      stepFunctionsRoleArn,
    },
    cloudFormation: {
      managed: true,
      stackStatus,
      templatePath: '.local/aws/harness-stack.template.json',
    },
    artifacts: {
      lambdaZip: {
        bucketName: artifactBucketName,
        objectKey: artifactObjectKey,
      },
      itemReader: itemReaderArtifacts,
    },
    environment,
    snapshotRedactingTags: {
      ACCOUNT_ID: config.accountId,
      REGION: config.region,
      WORKSPACE_HASH: config.workspaceHash,
      ...(artifactBucketName ? { HARNESS_ARTIFACT_BUCKET: artifactBucketName } : {}),
      ...(itemReaderArtifacts?.bucketName
        ? { ITEMREADER_BUCKET: itemReaderArtifacts.bucketName }
        : {}),
    },
  };
}

async function deleteRoleIfTagged(roleName: string, filters: HarnessTagFilters): Promise<boolean> {
  const role = await getRoleIfExists(roleName);
  if (!role?.Arn) {
    return false;
  }

  const tags = Object.fromEntries((role.Tags ?? []).map(tag => [tag.Key ?? '', tag.Value ?? '']));
  if (!tagsMatchHarness(tags, filters)) {
    return false;
  }

  const inlinePolicies = await iamClient.send(new ListRolePoliciesCommand({ RoleName: roleName }));
  for (const policyName of inlinePolicies.PolicyNames ?? []) {
    await iamClient.send(
      new DeleteRolePolicyCommand({
        RoleName: roleName,
        PolicyName: policyName,
      })
    );
  }

  const attachedPolicies = await iamClient.send(
    new ListAttachedRolePoliciesCommand({ RoleName: roleName })
  );
  for (const policy of attachedPolicies.AttachedPolicies ?? []) {
    if (!policy.PolicyArn) {
      continue;
    }

    await iamClient.send(
      new DetachRolePolicyCommand({
        RoleName: roleName,
        PolicyArn: policy.PolicyArn,
      })
    );
  }

  await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
  return true;
}

async function deleteLambdaFunctionIfTagged(
  functionName: string,
  filters: HarnessTagFilters
): Promise<boolean> {
  const existing = await getFunctionIfExists(functionName);
  if (!existing?.Configuration?.FunctionArn) {
    return false;
  }

  const tagsResponse = await lambdaClient.send(
    new ListTagsCommand({
      Resource: existing.Configuration.FunctionArn,
    })
  );

  if (!tagsMatchHarness(tagsResponse.Tags ?? {}, filters)) {
    return false;
  }

  await lambdaClient.send(new DeleteFunctionCommand({ FunctionName: functionName }));
  return true;
}

function tagsMatchHarness(
  tags: Record<string, string> | undefined,
  filters: HarnessTagFilters
): boolean {
  if (!filters.managedBy || !filters.workspace) {
    return false;
  }

  return (
    tags?.[TAG_KEYS.managedBy] === filters.managedBy &&
    tags?.[TAG_KEYS.workspace] === filters.workspace
  );
}

async function createZipArchive(
  outputPath: string,
  entries: Array<{ sourcePath: string; zipPath: string }>
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const zipFile = new ZipFile();
    const chunks: Buffer[] = [];

    zipFile.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zipFile.outputStream.on('error', rejectPromise);
    zipFile.outputStream.on('end', async () => {
      try {
        await writeFile(outputPath, Buffer.concat(chunks));
        resolvePromise();
      } catch (error) {
        rejectPromise(error);
      }
    });

    for (const entry of entries) {
      zipFile.addFile(entry.sourcePath, entry.zipPath);
    }

    zipFile.end();
  });
}

async function getRoleIfExists(roleName: string) {
  try {
    const response = await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    return response.Role;
  } catch (error) {
    if (isIamNotFound(error)) {
      return null;
    }

    throw error;
  }
}

async function getFunctionIfExists(functionName: string) {
  try {
    return await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
  } catch (error) {
    if (isLambdaNotFound(error)) {
      return null;
    }

    throw error;
  }
}

function isIamNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === 'NoSuchEntityException';
}

function isLambdaNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === 'ResourceNotFoundException';
}

function isLogsNotFound(error: unknown): boolean {
  return error instanceof Error && error.name === 'ResourceNotFoundException';
}

function isStepFunctionsNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'StateMachineDoesNotExist' || error.name === 'ResourceNotFoundException')
  );
}

async function getCallerIdentityIfAvailable() {
  try {
    return await stsClient.send(new GetCallerIdentityCommand({}));
  } catch {
    return null;
  }
}

function readAwsCliConfiguredRegion(profileName?: string): string | undefined {
  try {
    const args = profileName
      ? ['configure', 'get', 'region', '--profile', profileName]
      : ['configure', 'get', 'region'];
    const region = execFileSync('aws', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return region.length > 0 ? region : undefined;
  } catch {
    return undefined;
  }
}

function readAwsCliAccountId(): string | undefined {
  try {
    const accountId = execFileSync(
      'aws',
      ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    ).trim();

    return accountId.length > 0 ? accountId : undefined;
  } catch {
    return undefined;
  }
}

function getAwsProfileName(): string {
  return process.env.AWS_PROFILE ?? process.env.AWS_DEFAULT_PROFILE ?? 'default';
}

function readAwsSharedConfigRegion(profileName: string): string | undefined {
  return readAwsIniSetting({
    filePath: resolve(homedir(), '.aws', 'config'),
    sectionName: profileName === 'default' ? 'default' : `profile ${profileName}`,
    key: 'region',
  });
}

function readAwsSharedCredentialsRegion(profileName: string): string | undefined {
  return readAwsIniSetting({
    filePath: resolve(homedir(), '.aws', 'credentials'),
    sectionName: profileName,
    key: 'region',
  });
}

function readAwsIniSetting({
  filePath,
  sectionName,
  key,
}: {
  filePath: string;
  sectionName: string;
  key: string;
}): string | undefined {
  try {
    const source = readFileSync(filePath, 'utf8');
    const sections = parseIniSections(source);
    const value = sections[sectionName]?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseIniSections(source: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let currentSectionName = '';

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSectionName = line.slice(1, -1).trim();
      sections[currentSectionName] = sections[currentSectionName] ?? {};
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1 || currentSectionName.length === 0) {
      continue;
    }

    const iniKey = line.slice(0, separatorIndex).trim();
    const iniValue = line.slice(separatorIndex + 1).trim();
    sections[currentSectionName] = sections[currentSectionName] ?? {};
    sections[currentSectionName][iniKey] = iniValue;
  }

  return sections;
}
