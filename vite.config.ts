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
  fmt: {
    trailingComma: 'es5',
    tabWidth: 2,
    semi: true,
    singleQuote: true,
    printWidth: 100,
    endOfLine: 'lf',
    arrowParens: 'avoid',
    sortPackageJson: false,
    ignorePatterns: [
      'pnpm-lock.yaml',
      'coverage/',
      'lib/',
      'node_modules/',
      'test-reports/',
      'tests/conformance/cases/.snapshots/',
      // Preserve the external ASL reference; Oxfmt currently removes spaces around JSONata code.
      'docs/references/ASL_SPEC.md',
    ],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'vitest', 'node', 'promise', 'import'],
    ignorePatterns: ['lib/**/*', 'node_modules/**/*'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      'vitest/require-mock-type-parameters': 'off',
    },
    overrides: [
      {
        files: ['tests/conformance/cases/**/*.ts'],
        rules: {
          // Case builders register assertion callbacks executed by the conformance suite.
          'vitest/no-standalone-expect': [
            'warn',
            {
              additionalTestBlockFunctions: [
                'singleExpressionCase',
                'multiExpressionCase',
                'customDefinitionCase',
                'matchChoiceCase',
                'expectOutputSatisfying',
              ],
            },
          ],
        },
      },
      {
        files: ['tests/conformance.spec.ts'],
        rules: {
          // Runner selection and generated group titles are resolved at runtime.
          'vitest/no-conditional-tests': 'off',
          'vitest/valid-title': ['warn', { allowArguments: true }],
          // assertExpected enforces expect.hasAssertions(); runner guards fail by throwing.
          'vitest/expect-expect': 'off',
        },
      },
      {
        files: ['src/utils/selectPath.spec.ts'],
        rules: {
          // These negative-input cases require rejection, not a particular error message.
          'vitest/require-to-throw-message': 'off',
        },
      },
    ],
  },
  staged: {
    '*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}': 'vp check --fix',
  },
});
