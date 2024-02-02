import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-reports/junit.xml',
    },
    include: ['{src,tests}/**/*.spec.ts'],
  },
});
