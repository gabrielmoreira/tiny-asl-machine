/* eslint-env node */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CloudFormationClient,
  CreateStackCommand,
  DeleteStackCommand,
  DescribeStacksCommand,
  UpdateStackCommand,
  waitUntilStackCreateComplete,
  waitUntilStackDeleteComplete,
  waitUntilStackUpdateComplete,
  type Parameter,
  type Stack,
  type Tag,
} from '@aws-sdk/client-cloudformation';
import { GetRoleCommand, IAMClient } from '@aws-sdk/client-iam';
import { GetFunctionCommand, LambdaClient } from '@aws-sdk/client-lambda';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import type { HarnessConfig } from './aws-harness-lib.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
export const cloudFormationTemplatePath = resolve(
  repoRoot,
  '.local',
  'aws',
  'harness-stack.template.json'
);

const STACK_WAIT_TIMEOUT_SECONDS = 600;
const TAG_KEYS = {
  managedBy: 'tiny-asl-machine:managed-by',
  workspace: 'tiny-asl-machine:workspace',
  stack: 'tiny-asl-machine:stack',
  repo: 'tiny-asl-machine:repo',
} as const;
const iamClient = new IAMClient({});
const lambdaClient = new LambdaClient({});

type ArtifactLocation = {
  bucketName: string;
  objectKey: string;
};

type OptionalArtifactLocation = {
  region: string;
  bucketName?: string;
  objectKey?: string;
};

type StackParameterInput = {
  config: HarnessConfig;
  artifactBucketName: string;
  artifactObjectKey: string;
};

type DescribeStackInput = {
  cloudFormationClient: CloudFormationClient;
  stackName: string;
};

type StackOutputsInput = DescribeStackInput & StackParameterInput;

type StackOutputs = {
  lambdaFunctionArn?: string;
  lambdaRoleArn?: string;
  stepFunctionsRoleArn?: string;
  lambdaFunctionName: string;
  lambdaRoleName: string;
  stepFunctionsRoleName: string;
  stackStatus?: string;
  artifactBucketName: string;
  artifactObjectKey: string;
};

export function assertDeployableHarnessConfig(config: HarnessConfig): void {
  if (!config.region || config.region === 'unknown') {
    throw new Error(
      'AWS region is unknown. Run aws:create-deployment-config after configuring AWS CLI/SDK region, or set the machine-level AWS region before deploy.'
    );
  }

  if (!config.accountId || config.accountId === 'unknown') {
    throw new Error(
      'AWS accountId is unknown. Ensure AWS credentials are available to the AWS SDK/CLI before deploy.'
    );
  }
}

export function buildHarnessArtifactBucketName(config: HarnessConfig): string {
  return `tiny-asl-machine-aws-${config.workspaceHash}-${config.accountId}-artifacts`;
}

export async function ensureHarnessArtifactBucket({
  region,
  bucketName,
}: {
  region: string;
  bucketName: string;
}): Promise<string> {
  const s3Client = new S3Client({ region });

  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return bucketName;
  } catch (error) {
    if (!isS3NotFound(error)) {
      throw error;
    }
  }

  await s3Client.send(
    new CreateBucketCommand({
      Bucket: bucketName,
      ...(region === 'us-east-1'
        ? {}
        : {
            CreateBucketConfiguration: {
              LocationConstraint: region as BucketLocationConstraint,
            },
          }),
    })
  );

  return bucketName;
}

export async function uploadHarnessLambdaArtifact({
  config,
  zipPath,
  bucketName,
}: {
  config: HarnessConfig;
  zipPath: string;
  bucketName: string;
}): Promise<ArtifactLocation> {
  const zipFile = await readFile(zipPath);
  const objectHash = createHash('sha256').update(zipFile).digest('hex').slice(0, 16);
  const objectKey = `lambda-fixture/${config.workspaceHash}/${objectHash}.zip`;
  const s3Client = new S3Client({ region: config.region });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: zipFile,
      ContentType: 'application/zip',
      Metadata: {
        stack: config.stackName,
        workspace: config.workspaceHash,
      },
      Tagging: new URLSearchParams({
        [TAG_KEYS.managedBy]: config.tags[TAG_KEYS.managedBy],
        [TAG_KEYS.workspace]: config.tags[TAG_KEYS.workspace],
        [TAG_KEYS.stack]: config.tags[TAG_KEYS.stack],
        [TAG_KEYS.repo]: config.tags[TAG_KEYS.repo],
      }).toString(),
    })
  );

  return {
    bucketName,
    objectKey,
  };
}

export async function uploadHarnessObservationArtifact({
  region,
  bucketName,
  objectKey,
  body,
  contentType = 'application/json',
  metadata,
}: {
  region: string;
  bucketName: string;
  objectKey: string;
  body: string | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
}): Promise<ArtifactLocation> {
  const s3Client = new S3Client({ region });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    })
  );

  return {
    bucketName,
    objectKey,
  };
}

export async function deleteHarnessLambdaArtifact({
  region,
  bucketName,
  objectKey,
}: OptionalArtifactLocation): Promise<boolean> {
  if (!bucketName || !objectKey) {
    return false;
  }

  const s3Client = new S3Client({ region });

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
    return true;
  } catch (error) {
    if (isS3NotFound(error)) {
      return false;
    }

    throw error;
  }
}

export function buildHarnessStackParameters({
  config,
  artifactBucketName,
  artifactObjectKey,
}: StackParameterInput): Parameter[] {
  return [
    parameter('ManagedByTagValue', config.tags[TAG_KEYS.managedBy]),
    parameter('WorkspaceTagValue', config.tags[TAG_KEYS.workspace]),
    parameter('StackTagValue', config.tags[TAG_KEYS.stack]),
    parameter('RepoTagValue', config.tags[TAG_KEYS.repo]),
    parameter('LambdaFunctionName', config.names.lambdaFunctionName),
    parameter('LambdaRoleName', config.names.lambdaRoleName),
    parameter('StepFunctionsRoleName', config.names.stepFunctionsRoleName),
    parameter('LambdaCodeS3Bucket', artifactBucketName),
    parameter('LambdaCodeS3Key', artifactObjectKey),
    parameter('LambdaEnvironmentStack', config.stackName),
    parameter('LambdaEnvironmentWorkspace', config.workspaceHash),
  ];
}

export async function deployHarnessStack({
  config,
  artifactBucketName,
  artifactObjectKey,
}: StackParameterInput): Promise<StackOutputs> {
  const cloudFormationClient = new CloudFormationClient({ region: config.region });
  const templateBody = await readFile(cloudFormationTemplatePath, 'utf8');
  const parameters = buildHarnessStackParameters({
    config,
    artifactBucketName,
    artifactObjectKey,
  });
  const tags: Tag[] = Object.entries(config.tags).map(([Key, Value]) => ({ Key, Value }));
  let existingStack = await describeHarnessStack({
    cloudFormationClient,
    stackName: config.stackName,
  });

  if (existingStack && !(await isHarnessStackMaterialized(existingStack, config))) {
    await cloudFormationClient.send(
      new DeleteStackCommand({
        StackName: config.stackName,
      })
    );

    await waitUntilStackDeleteComplete(
      {
        client: cloudFormationClient,
        maxWaitTime: STACK_WAIT_TIMEOUT_SECONDS,
      },
      { StackName: config.stackName }
    );

    existingStack = null;
  }

  if (existingStack && existingStack.StackStatus === 'ROLLBACK_COMPLETE') {
    await cloudFormationClient.send(
      new DeleteStackCommand({
        StackName: config.stackName,
      })
    );

    await waitUntilStackDeleteComplete(
      {
        client: cloudFormationClient,
        maxWaitTime: STACK_WAIT_TIMEOUT_SECONDS,
      },
      { StackName: config.stackName }
    );

    existingStack = null;
  }

  if (!existingStack) {
    await cloudFormationClient.send(
      new CreateStackCommand({
        StackName: config.stackName,
        TemplateBody: templateBody,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
        Parameters: parameters,
        Tags: tags,
      })
    );

    await waitUntilStackCreateComplete(
      {
        client: cloudFormationClient,
        maxWaitTime: STACK_WAIT_TIMEOUT_SECONDS,
      },
      { StackName: config.stackName }
    );
  } else {
    try {
      await cloudFormationClient.send(
        new UpdateStackCommand({
          StackName: config.stackName,
          TemplateBody: templateBody,
          Capabilities: ['CAPABILITY_NAMED_IAM'],
          Parameters: parameters,
          Tags: tags,
        })
      );

      await waitUntilStackUpdateComplete(
        {
          client: cloudFormationClient,
          maxWaitTime: STACK_WAIT_TIMEOUT_SECONDS,
        },
        { StackName: config.stackName }
      );
    } catch (error) {
      if (!isNoUpdateError(error)) {
        throw error;
      }
    }
  }

  return await getHarnessStackOutputs({
    cloudFormationClient,
    stackName: config.stackName,
    config,
    artifactBucketName,
    artifactObjectKey,
  });
}

export async function deleteHarnessStack({ config }: { config: HarnessConfig }): Promise<boolean> {
  const cloudFormationClient = new CloudFormationClient({ region: config.region });
  const existingStack = await describeHarnessStack({
    cloudFormationClient,
    stackName: config.stackName,
  });

  if (!existingStack) {
    return false;
  }

  await cloudFormationClient.send(
    new DeleteStackCommand({
      StackName: config.stackName,
    })
  );

  await waitUntilStackDeleteComplete(
    {
      client: cloudFormationClient,
      maxWaitTime: STACK_WAIT_TIMEOUT_SECONDS,
    },
    { StackName: config.stackName }
  );

  return true;
}

export async function describeHarnessStack({
  cloudFormationClient,
  stackName,
}: DescribeStackInput): Promise<Stack | null> {
  try {
    const response = await cloudFormationClient.send(
      new DescribeStacksCommand({
        StackName: stackName,
      })
    );

    return response.Stacks?.[0] ?? null;
  } catch (error) {
    if (isStackNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getHarnessStackOutputs({
  cloudFormationClient,
  stackName,
  config,
  artifactBucketName,
  artifactObjectKey,
}: StackOutputsInput): Promise<StackOutputs> {
  const stack = await describeHarnessStack({ cloudFormationClient, stackName });
  if (!stack) {
    throw new Error(`CloudFormation stack ${stackName} does not exist.`);
  }

  const outputMap = Object.fromEntries(
    (stack.Outputs ?? [])
      .filter(output => output.OutputKey && output.OutputValue)
      .map(output => [output.OutputKey ?? '', output.OutputValue ?? ''])
  ) as Record<string, string>;

  return {
    lambdaFunctionArn: outputMap.LambdaFunctionArn,
    lambdaRoleArn: outputMap.LambdaRoleArn,
    stepFunctionsRoleArn: outputMap.StepFunctionsRoleArn,
    lambdaFunctionName: outputMap.LambdaFunctionName ?? config.names.lambdaFunctionName,
    lambdaRoleName: outputMap.LambdaRoleName ?? config.names.lambdaRoleName,
    stepFunctionsRoleName: outputMap.StepFunctionsRoleName ?? config.names.stepFunctionsRoleName,
    stackStatus: stack.StackStatus,
    artifactBucketName,
    artifactObjectKey,
  };
}

function parameter(ParameterKey: string, ParameterValue: string): Parameter {
  return {
    ParameterKey,
    ParameterValue,
  };
}

function isNoUpdateError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'ValidationError' &&
    /No updates are to be performed/i.test(error.message)
  );
}

function isStackNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'ValidationError' &&
    /does not exist/i.test(error.message)
  );
}

function isS3NotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const namedError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    namedError.name === 'NotFound' ||
    namedError.name === 'NoSuchBucket' ||
    namedError.name === 'NoSuchKey' ||
    namedError.$metadata?.httpStatusCode === 404
  );
}

async function isHarnessStackMaterialized(stack: Stack, config: HarnessConfig): Promise<boolean> {
  const outputMap = Object.fromEntries(
    (stack.Outputs ?? [])
      .filter(output => output.OutputKey && output.OutputValue)
      .map(output => [output.OutputKey ?? '', output.OutputValue ?? ''])
  ) as Record<string, string>;

  const lambdaFunctionName = outputMap.LambdaFunctionName ?? config.names.lambdaFunctionName;
  const lambdaRoleName = outputMap.LambdaRoleName ?? config.names.lambdaRoleName;
  const stepFunctionsRoleName =
    outputMap.StepFunctionsRoleName ?? config.names.stepFunctionsRoleName;

  const [lambdaExists, lambdaRoleExists, stepRoleExists] = await Promise.all([
    hasLambdaFunction(lambdaFunctionName),
    hasIamRole(lambdaRoleName),
    hasIamRole(stepFunctionsRoleName),
  ]);

  return lambdaExists && lambdaRoleExists && stepRoleExists;
}

async function hasLambdaFunction(functionName: string): Promise<boolean> {
  try {
    await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'ResourceNotFoundException') {
      return false;
    }

    throw error;
  }
}

async function hasIamRole(roleName: string): Promise<boolean> {
  try {
    await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'NoSuchEntityException') {
      return false;
    }

    throw error;
  }
}
