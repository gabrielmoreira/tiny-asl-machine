/* eslint-env node */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(moduleDir, '..');
const libDir = resolve(repoRoot, 'lib');
const esmEntrypointPath = resolve(libDir, 'index.mjs');

mkdirSync(libDir, { recursive: true });
writeFileSync(
  esmEntrypointPath,
  [
    "import cjsModule from './index.js';",
    '',
    'export const { run, runState, createDefaultRuntime, createTestRuntime } = cjsModule;',
    'export default cjsModule;',
    '',
  ].join('\n'),
  'utf8'
);
