import { describe, expect, it } from 'vite-plus/test';
import {
  buildDeploymentConfig,
  resolveAccountId,
  resolveRegion,
  resolveWorkspaceHash,
} from '../scripts/aws-harness-lib.ts';

describe('deployment config metadata resolution', () => {
  it('resolves region in the required order', () => {
    expect(
      resolveRegion({
        envAwsRegion: 'env-region-1',
        envAwsDefaultRegion: 'env-default-region-1',
        existingRegion: 'existing-region-1',
        sharedConfigRegion: 'shared-config-region-1',
        sharedCredentialsRegion: 'shared-credentials-region-1',
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('env-region-1');

    expect(
      resolveRegion({
        envAwsDefaultRegion: 'env-default-region-1',
        existingRegion: 'existing-region-1',
        sharedConfigRegion: 'shared-config-region-1',
        sharedCredentialsRegion: 'shared-credentials-region-1',
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('env-default-region-1');

    expect(
      resolveRegion({
        existingRegion: 'existing-region-1',
        sharedConfigRegion: 'shared-config-region-1',
        sharedCredentialsRegion: 'shared-credentials-region-1',
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('existing-region-1');

    expect(
      resolveRegion({
        sharedConfigRegion: 'shared-config-region-1',
        sharedCredentialsRegion: 'shared-credentials-region-1',
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('shared-config-region-1');

    expect(
      resolveRegion({
        sharedCredentialsRegion: 'shared-credentials-region-1',
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('shared-credentials-region-1');

    expect(
      resolveRegion({
        awsCliProfileRegion: 'cli-profile-region-1',
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('cli-profile-region-1');

    expect(
      resolveRegion({
        awsCliRegion: 'cli-region-1',
      })
    ).toBe('cli-region-1');

    expect(resolveRegion({})).toBe('unknown');
  });

  it('resolves account id in the required order', () => {
    expect(
      resolveAccountId({
        stsAccountId: '111111111111',
        existingAccountId: '222222222222',
        awsCliAccountId: '333333333333',
      })
    ).toBe('111111111111');

    expect(
      resolveAccountId({
        existingAccountId: '222222222222',
        awsCliAccountId: '333333333333',
      })
    ).toBe('222222222222');

    expect(
      resolveAccountId({
        awsCliAccountId: '333333333333',
      })
    ).toBe('333333333333');
  });

  it('ignores legacy unknown placeholder values when resolving region and account', () => {
    expect(
      resolveRegion({
        existingRegion: 'unknown',
      })
    ).toBe('unknown');

    expect(
      resolveAccountId({
        existingAccountId: 'unknown',
        awsCliAccountId: '333333333333',
      })
    ).toBe('333333333333');
  });

  it('reuses workspace hash from existing deployment config before computing a new one', () => {
    expect(
      resolveWorkspaceHash({
        existingWorkspaceHash: 'existing-hash',
        computedWorkspaceHash: 'computed-hash',
      })
    ).toBe('existing-hash');

    expect(
      resolveWorkspaceHash({
        computedWorkspaceHash: 'computed-hash',
      })
    ).toBe('computed-hash');
  });
});

describe('buildDeploymentConfig', () => {
  it('persists cloudformation and artifact metadata while keeping environment consumers stable', () => {
    const deploymentConfig = buildDeploymentConfig({
      config: {
        accountId: '111111111111',
        region: 'eu-west-1',
        stackName: 'tiny-asl-machine-aws-testhash',
        workspaceHash: 'testhash',
        names: {
          lambdaFunctionName: 'lambda-fixture-name',
          lambdaRoleName: 'lambda-role-name',
          stepFunctionsRoleName: 'stepfunctions-role-name',
        },
        tags: {
          'tiny-asl-machine:managed-by': 'aws-conformance-harness',
          'tiny-asl-machine:workspace': 'testhash',
          'tiny-asl-machine:stack': 'tiny-asl-machine-aws-testhash',
          'tiny-asl-machine:repo': 'tiny-asl-machine',
        },
        environment: {
          AWS_TAM_TAG_MANAGED_BY: 'aws-conformance-harness',
          AWS_TAM_TAG_WORKSPACE: 'testhash',
          AWS_TAM_TAG_STACK: 'tiny-asl-machine-aws-testhash',
          AWS_TAM_TAG_REPO: 'tiny-asl-machine',
          AWS_REGION: 'eu-west-1',
          AWS_DEFAULT_REGION: 'eu-west-1',
        },
      },
      lambdaRoleArn: 'arn:aws:iam::111111111111:role/lambda-role-name',
      lambdaFunctionArn: 'arn:aws:lambda:eu-west-1:111111111111:function:lambda-fixture-name',
      stepFunctionsRoleArn: 'arn:aws:iam::111111111111:role/stepfunctions-role-name',
      artifactBucketName: 'tiny-asl-machine-artifacts',
      artifactObjectKey: 'lambda-fixture/testhash/abc.zip',
      stackStatus: 'CREATE_COMPLETE',
    });

    expect(deploymentConfig.resourceNames).toEqual({
      lambdaFunctionName: 'lambda-fixture-name',
      lambdaRoleName: 'lambda-role-name',
      stepFunctionsRoleName: 'stepfunctions-role-name',
    });
    expect(deploymentConfig.resources).toEqual({
      lambdaFunctionArn: 'arn:aws:lambda:eu-west-1:111111111111:function:lambda-fixture-name',
      lambdaRoleArn: 'arn:aws:iam::111111111111:role/lambda-role-name',
      stepFunctionsRoleArn: 'arn:aws:iam::111111111111:role/stepfunctions-role-name',
    });
    expect(deploymentConfig.cloudFormation).toEqual({
      managed: true,
      stackStatus: 'CREATE_COMPLETE',
      templatePath: '.local/aws/harness-stack.template.json',
    });
    expect(deploymentConfig.artifacts).toEqual({
      lambdaZip: {
        bucketName: 'tiny-asl-machine-artifacts',
        objectKey: 'lambda-fixture/testhash/abc.zip',
      },
    });
    expect(deploymentConfig.environment).toMatchObject({
      AWS_REGION: 'eu-west-1',
      AWS_DEFAULT_REGION: 'eu-west-1',
      AWS_SFN_ROLE_ARN: 'arn:aws:iam::111111111111:role/stepfunctions-role-name',
      AWS_LAMBDA_FIXTURE_FUNCTION_NAME: 'lambda-fixture-name',
      AWS_LAMBDA_FIXTURE_ARN: 'arn:aws:lambda:eu-west-1:111111111111:function:lambda-fixture-name',
      AWS_LAMBDA_FIXTURE_ROLE_ARN: 'arn:aws:iam::111111111111:role/lambda-role-name',
    });
  });
});
