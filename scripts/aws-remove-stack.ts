/* eslint-env node */

import { deleteHarnessLambdaArtifact, deleteHarnessStack } from './aws-cloudformation.ts';
import {
  deleteLambdaLogGroup,
  deleteTaggedStateMachines,
  getHarnessConfig,
  getHarnessTagFilters,
  readDeploymentConfig,
  removeDeploymentConfig,
} from './aws-harness-lib.ts';

async function main() {
  const deploymentConfig = await readDeploymentConfig();
  const config = await getHarnessConfig();
  const environment = Object.fromEntries(
    Object.entries(deploymentConfig?.environment ?? config.environment).filter(
      ([, value]) => typeof value !== 'undefined'
    )
  );
  const filters = getHarnessTagFilters(environment);
  const lambdaFunctionName =
    deploymentConfig?.resourceNames?.lambdaFunctionName ?? config.names.lambdaFunctionName;

  const deletedStateMachines = await deleteTaggedStateMachines(filters);
  const deletedStack = await deleteHarnessStack({ config });
  const deletedArtifact = await deleteHarnessLambdaArtifact({
    region: config.region,
    bucketName: deploymentConfig?.artifacts?.lambdaZip?.bucketName,
    objectKey: deploymentConfig?.artifacts?.lambdaZip?.objectKey,
  });
  const deletedLogGroup = lambdaFunctionName
    ? await deleteLambdaLogGroup(lambdaFunctionName)
    : false;

  await removeDeploymentConfig();

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: {
          stateMachines: deletedStateMachines,
          cloudFormationStack: deletedStack,
          lambdaArtifact: deletedArtifact,
          lambdaLogGroup: deletedLogGroup,
        },
        removedDeploymentConfig: true,
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
