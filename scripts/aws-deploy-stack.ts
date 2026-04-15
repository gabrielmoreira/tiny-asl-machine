/* eslint-env node */

import { setTimeout as delay } from 'node:timers/promises';
import {
  assertDeployableHarnessConfig,
  buildHarnessArtifactBucketName,
  deployHarnessStack,
  ensureHarnessArtifactBucket,
  uploadHarnessLambdaArtifact,
  uploadHarnessObservationArtifact,
} from './aws-cloudformation.ts';
import {
  buildDeploymentConfig,
  cleanupLegacyHarnessResources,
  ensureLambdaBundle,
  getHarnessConfig,
  readDeploymentConfig,
  writeDeploymentConfig,
} from './aws-harness-lib.ts';

async function main() {
  const existingDeploymentConfig = await readDeploymentConfig();
  const config = await getHarnessConfig();
  assertDeployableHarnessConfig(config);
  if (!existingDeploymentConfig?.cloudFormation?.managed) {
    await cleanupLegacyHarnessResources(config);
  }

  const zipPath = await ensureLambdaBundle();
  const artifactBucketName = await ensureHarnessArtifactBucket({
    region: config.region,
    bucketName: buildHarnessArtifactBucketName(config),
  });
  const artifact = await uploadHarnessLambdaArtifact({
    config,
    zipPath,
    bucketName: artifactBucketName,
  });

  const itemReaderJsonItemsPointerKey = `itemreader-fixtures/${config.workspaceHash}/json/nested-items.json`;
  const itemReaderListNonePrefix = `itemreader-fixtures/${config.workspaceHash}/list-none/`;
  const itemReaderLoadAndFlattenPrefix = `itemreader-fixtures/${config.workspaceHash}/load-and-flatten/`;
  const itemReaderCsvFirstRowKey = `itemreader-fixtures/${config.workspaceHash}/csv/first-row.csv`;
  const itemReaderCsvPipeKey = `itemreader-fixtures/${config.workspaceHash}/csv/pipe.csv`;
  const itemReaderCsvGivenKey = `itemreader-fixtures/${config.workspaceHash}/csv/given.csv`;
  const itemReaderJsonlKey = `itemreader-fixtures/${config.workspaceHash}/jsonl/records.jsonl`;

  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: itemReaderJsonItemsPointerKey,
    body: JSON.stringify({ data: { items: [{ id: 'a' }, { id: 'b' }] } }),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: `${itemReaderListNonePrefix}a.json`,
    body: JSON.stringify({ ok: true }),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: `${itemReaderListNonePrefix}b.json`,
    body: JSON.stringify({ ok: true }),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: `${itemReaderLoadAndFlattenPrefix}one.json`,
    body: JSON.stringify([{ id: 'one-a' }, { id: 'one-b' }]),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: `${itemReaderLoadAndFlattenPrefix}two.json`,
    body: JSON.stringify([{ id: 'two-a' }]),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: itemReaderCsvFirstRowKey,
    body: ['id,name', '1,Alice', '2,Bob', '3,Carol'].join('\n'),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: itemReaderCsvPipeKey,
    body: ['id|name', '1|Alice', '2|Bob'].join('\n'),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: itemReaderCsvGivenKey,
    body: ['1,Alice', '2,Bob'].join('\n'),
  });
  await uploadHarnessObservationArtifact({
    region: config.region,
    bucketName: artifactBucketName,
    objectKey: itemReaderJsonlKey,
    body: ['{"id":"x"}', '{"id":"y"}'].join('\n'),
  });
  const stackOutputs = await deployHarnessStack({
    config,
    artifactBucketName: artifact.bucketName,
    artifactObjectKey: artifact.objectKey,
  });

  await delay(10_000);

  const deploymentConfig = buildDeploymentConfig({
    config,
    lambdaRoleArn: stackOutputs.lambdaRoleArn,
    lambdaFunctionArn: stackOutputs.lambdaFunctionArn,
    stepFunctionsRoleArn: stackOutputs.stepFunctionsRoleArn,
    artifactBucketName: stackOutputs.artifactBucketName,
    artifactObjectKey: stackOutputs.artifactObjectKey,
    stackStatus: stackOutputs.stackStatus,
    itemReaderArtifacts: {
      bucketName: artifactBucketName,
      jsonItemsPointerKey: itemReaderJsonItemsPointerKey,
      listNonePrefix: itemReaderListNonePrefix,
      loadAndFlattenPrefix: itemReaderLoadAndFlattenPrefix,
      csvFirstRowKey: itemReaderCsvFirstRowKey,
      csvPipeKey: itemReaderCsvPipeKey,
      csvGivenKey: itemReaderCsvGivenKey,
      jsonlKey: itemReaderJsonlKey,
    },
  });
  await writeDeploymentConfig(deploymentConfig);

  console.log(
    JSON.stringify(
      {
        ok: true,
        deploymentConfigPath: '.local/aws/deployment-config.json',
        cleanedLegacyResources: !existingDeploymentConfig?.cloudFormation?.managed,
        resources: deploymentConfig.resources,
        cloudFormation: deploymentConfig.cloudFormation,
        artifacts: deploymentConfig.artifacts,
        environment: deploymentConfig.environment,
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
