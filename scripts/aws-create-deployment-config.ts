/* eslint-env node */

import {
  buildDeploymentConfig,
  getHarnessConfig,
  writeDeploymentConfig,
} from './aws-harness-lib.ts';

async function main() {
  const config = await getHarnessConfig();
  const deploymentConfig = buildDeploymentConfig({
    config,
    lambdaRoleArn: undefined,
    lambdaFunctionArn: undefined,
    stepFunctionsRoleArn: undefined,
    artifactBucketName: undefined,
    artifactObjectKey: undefined,
    stackStatus: 'NOT_DEPLOYED',
  });

  await writeDeploymentConfig(deploymentConfig);

  console.log(
    JSON.stringify(
      {
        ok: true,
        deploymentConfigPath: '.local/aws/deployment-config.json',
        region: deploymentConfig.region,
        accountId: deploymentConfig.accountId,
        resourceNames: deploymentConfig.resourceNames,
        snapshotRedactingTags: deploymentConfig.snapshotRedactingTags,
      },
      null,
      2
    )
  );
}
main().catch(error => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
