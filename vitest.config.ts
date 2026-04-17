import { configDefaults, defineConfig } from 'vite-plus';
import { getDeploymentConfig } from './tests/conformance/support/deploymentConfig';

getDeploymentConfig();

const awsBackedRun = process.env.CONFORMANCE_AWS === '1';

export default defineConfig({
  test: {
    maxConcurrency: awsBackedRun ? 5 : 8,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-reports/junit.xml',
    },
    include: ['{src,tests}/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, '{src,tests}/**/*.integration.spec.ts'],
    fileParallelism: !awsBackedRun,
  },
});
