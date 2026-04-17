import {
  getDeploymentConfig as getDeploymentConfigFromJs,
  getDeploymentEnv as getDeploymentEnvFromJs,
  getDeploymentStateMachineTags as getDeploymentStateMachineTagsFromJs,
} from '../../../scripts/deployment-config.ts';

export type DeploymentConfigFile = {
  region?: string;
  accountId?: string;
  snapshotRedactingTags?: Record<string, string>;
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
  artifacts?: {
    lambdaZip?: {
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
};

export type DeploymentConfigState = {
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

export type DeploymentStateMachineTag = {
  key: string;
  value: string;
};

export function getDeploymentConfig(): DeploymentConfigState {
  return getDeploymentConfigFromJs() as DeploymentConfigState;
}

export function getDeploymentEnv(): Record<string, string> {
  return getDeploymentEnvFromJs() as Record<string, string>;
}

export function getDeploymentStateMachineTags(): DeploymentStateMachineTag[] {
  return getDeploymentStateMachineTagsFromJs() as DeploymentStateMachineTag[];
}
