import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    trailingComma: 'es5',
    tabWidth: 2,
    semi: true,
    singleQuote: true,
    printWidth: 100,
    arrowParens: 'avoid',
    sortPackageJson: false,
    ignorePatterns: [
      'pnpm-lock.yaml',
      'coverage/',
      'lib/',
      'node_modules/',
      'test-reports/',
      'tests/conformance/cases/.snapshots/',
    ],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'vitest', 'node', 'promise', 'import'],
    ignorePatterns: ['lib/**/*', 'node_modules/**/*'],
    options: {
      typeAware: true,
      typeCheck: false,
    },
    rules: {
      'vitest/no-conditional-tests': 'off',
      'vitest/require-mock-type-parameters': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/expect-expect': 'off',
      'jest/valid-title': 'off',
      'jest/require-to-throw-message': 'off',
    },
  },
  staged: {
    '*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml}': 'vp check --fix',
  },
});
