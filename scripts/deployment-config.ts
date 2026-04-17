/* eslint-env node */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, '..');
const defaultDeploymentConfigPath = resolve(repoRoot, '.local', 'aws', 'deployment-config.json');
const deploymentManagedEnvKeys = new Set([
  'AWS_SFN_ROLE_ARN',
  'AWS_LAMBDA_FIXTURE_FUNCTION_NAME',
  'AWS_LAMBDA_FIXTURE_ARN',
  'AWS_LAMBDA_FIXTURE_ROLE_ARN',
  'AWS_TAM_TAG_MANAGED_BY',
  'AWS_TAM_TAG_WORKSPACE',
  'AWS_TAM_TAG_STACK',
  'AWS_TAM_TAG_REPO',
]);
export type DeploymentConfigFile = {
  region?: string;
  accountId?: string;
  environment?: Record<string, string>;
  resourceNames?: {
    lambdaFunctionName?: string;
    lambdaRoleName?: string;
    stepFunctionsRoleName?: string;
  };
  resources?: {
    lambdaFunctionArn?: string;
    lambdaRoleArn?: string;
    stepFunctionsRoleArn?: string;
  };
  snapshotRedactingTags?: Record<string, string>;
};

type DeploymentConfigState = {
  repoRoot: string;
  deploymentConfigPath: string;
  deploymentConfig: DeploymentConfigFile | null;
  env: Record<string, string>;
  aws: {
    region?: string;
    accountId?: string;
    stepFunctionsRoleArn?: string;
    lambdaFixtureArn?: string;
    lambdaFixtureFunctionName?: string;
    lambdaFixtureRoleArn?: string;
  };
  tags: {
    managedBy?: string;
    workspace?: string;
    stack?: string;
    repo?: string;
  };
};

let cachedDeploymentConfigState: DeploymentConfigState | undefined;

export function getDeploymentConfig(): DeploymentConfigState {
  if (cachedDeploymentConfigState) {
    return cachedDeploymentConfigState;
  }

  const deploymentConfigPath = defaultDeploymentConfigPath;
  const deploymentConfig = readDeploymentConfigIfPresent(deploymentConfigPath);
  const env = resolveDeploymentEnv(deploymentConfig);

  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  cachedDeploymentConfigState = {
    repoRoot,
    deploymentConfigPath,
    deploymentConfig,
    env,
    aws: {
      region: env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? deploymentConfig?.region,
      accountId: deploymentConfig?.accountId,
      stepFunctionsRoleArn:
        env.AWS_SFN_ROLE_ARN ?? deploymentConfig?.resources?.stepFunctionsRoleArn,
      lambdaFixtureArn:
        env.AWS_LAMBDA_FIXTURE_ARN ?? deploymentConfig?.resources?.lambdaFunctionArn,
      lambdaFixtureFunctionName:
        env.AWS_LAMBDA_FIXTURE_FUNCTION_NAME ?? deploymentConfig?.resourceNames?.lambdaFunctionName,
      lambdaFixtureRoleArn:
        env.AWS_LAMBDA_FIXTURE_ROLE_ARN ?? deploymentConfig?.resources?.lambdaRoleArn,
    },
    tags: {
      managedBy: env.AWS_TAM_TAG_MANAGED_BY,
      workspace: env.AWS_TAM_TAG_WORKSPACE,
      stack: env.AWS_TAM_TAG_STACK,
      repo: env.AWS_TAM_TAG_REPO,
    },
  };

  return cachedDeploymentConfigState;
}

export function getDeploymentEnv() {
  return getDeploymentConfig().env;
}

export function getDeploymentStateMachineTags() {
  const config = getDeploymentConfig();

  return [
    ['tiny-asl-machine:managed-by', config.tags.managedBy],
    ['tiny-asl-machine:workspace', config.tags.workspace],
    ['tiny-asl-machine:stack', config.tags.stack],
    ['tiny-asl-machine:repo', config.tags.repo],
  ]
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([key, value]) => ({ key, value }));
}

export function getDefaultDeploymentConfigPath() {
  return defaultDeploymentConfigPath;
}

function resolveDeploymentEnv(
  deploymentConfig: DeploymentConfigFile | null
): Record<string, string> {
  const explicit = compactEnv(process.env);
  const explicitNonDeployment = Object.fromEntries(
    Object.entries(explicit).filter(([key]) => !deploymentManagedEnvKeys.has(key))
  );
  const derivedRegion =
    explicit.AWS_REGION ??
    explicit.AWS_DEFAULT_REGION ??
    deploymentConfig?.region ??
    deriveRegionFromArn(deploymentConfig?.resources?.lambdaFunctionArn);

  const derived: Record<string, string | undefined> = {
    ...deploymentConfig?.environment,
  };

  if (derivedRegion) {
    if (!explicit.AWS_REGION && !derived.AWS_REGION) {
      derived.AWS_REGION = derivedRegion;
    }

    if (!explicit.AWS_DEFAULT_REGION && !derived.AWS_DEFAULT_REGION) {
      derived.AWS_DEFAULT_REGION = derivedRegion;
    }
  }

  return compactEnv({
    ...derived,
    ...explicitNonDeployment,
  });
}

function readDeploymentConfigIfPresent(path: string): DeploymentConfigFile | null {
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, 'utf8')) as DeploymentConfigFile;
}

function deriveRegionFromArn(arn: string | undefined): string | undefined {
  if (typeof arn !== 'string') {
    return undefined;
  }

  const parts = arn.split(':');
  return parts.length > 3 && parts[3] ? parts[3] : undefined;
}

function compactEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => typeof value === 'string' && value.length > 0)
  ) as Record<string, string>;
}
