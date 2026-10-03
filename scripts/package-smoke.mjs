#!/usr/bin/env node
// Exercise a built tarball, or an exact published version, as an isolated consumer.
// Never build, publish, install global tools, or run package lifecycle hooks.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const floorVersion = '22.0.0';
const registry = 'https://registry.npmjs.org/';
const exactVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/;
const runtimeCases = [
  'runtime-adapter',
  'JSONPath-intrinsics',
  'JSONata',
  'Map',
  'Parallel',
  'Fail',
  'JSONata-error',
];
const typedCases = ['JSONPath-intrinsics', 'JSONata', 'Fail'];
const requiredStages = [
  'prerequisites',
  'package',
  'install',
  'manifest',
  'current-require',
  'current-import',
  'floor-require',
  'floor-import',
  'strict-NodeNext-TS7',
  'current-typed-cjs',
  'current-typed-mjs',
  'floor-typed-cjs',
  'floor-typed-mjs',
];
const manifestContract = {
  name: 'tiny-asl-machine',
  main: 'lib/index.js',
  module: 'lib/index.mjs',
  types: 'lib/index.d.ts',
  exports: {
    '.': { types: './lib/index.d.ts', require: './lib/index.js', import: './lib/index.mjs' },
  },
  engines: { node: '>=22.0.0', pnpm: '>=10.0.0' },
  files: ['lib', 'types', 'skills', 'LICENSE'],
  sideEffects: false,
  engineStrict: true,
};
const results = {};
const versions = { currentNode: process.version };
let evidenceRoot;
let consumerRoot;
let packRoot;
let logPath;
let childEnv;
let toolEnv;

function jsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}
function isWithin(parent, path) {
  const difference = relative(realpathSync(parent), realpathSync(path));
  return (
    difference === '' ||
    (!isAbsolute(difference) && difference !== '..' && !difference.startsWith('..' + sep))
  );
}
function executable(path, label) {
  assert.ok(isAbsolute(path), label + ' must be an absolute executable path');
  assert.ok(existsSync(path) && statSync(path).isFile(), label + ' executable is missing');
  assert.ok(
    !/\.(cmd|bat)$/i.test(path),
    label + ': use a native executable or .cjs/.mjs/.js launcher, not a shell shim'
  );
  return /\.(cjs|mjs|js)$/i.test(path)
    ? { binary: process.execPath, prefix: [path] }
    : { binary: path, prefix: [] };
}
function parseArguments(args) {
  if (args.length === 0) return { mode: 'pack' };
  const usage =
    'Usage: node scripts/package-smoke.mjs [--version <exact semver> | --tarball <path>]';
  assert.ok(args.length === 2 && args[1].length > 0, usage);
  if (args[0] === '--version') {
    assert.ok(exactVersion.test(args[1]), usage);
    return { mode: 'registry', version: args[1] };
  }
  assert.equal(args[0], '--tarball', usage);
  const tarball = resolve(args[1]);
  assert.ok(
    extname(tarball) === '.tgz' && existsSync(tarball) && statSync(tarball).isFile(),
    '--tarball requires an existing .tgz file'
  );
  return { mode: 'tarball', tarball };
}
function initializeEvidence() {
  evidenceRoot = mkdtempSync(join(tmpdir(), 'tiny-asl-machine-consumer-'));
  consumerRoot = join(evidenceRoot, 'consumer');
  packRoot = join(evidenceRoot, 'packed');
  logPath = join(evidenceRoot, 'processes.log');
  writeFileSync(logPath, 'Isolated package-consumer smoke\n');
  // A configured TMP directory must not put the consumer in this or an enclosing checkout.
  for (let directory = sourceRoot; ; directory = dirname(directory)) {
    if (existsSync(join(directory, '.git'))) {
      assert.ok(
        !isWithin(directory, evidenceRoot),
        'The temporary consumer must be outside the checkout; set TMPDIR/TEMP accordingly'
      );
    }
    if (dirname(directory) === directory) break;
  }
  mkdirSync(consumerRoot);
  mkdirSync(packRoot);
  const home = join(evidenceRoot, 'home');
  mkdirSync(home);
  const userConfig = join(home, 'user.npmrc');
  const globalConfig = join(home, 'global.npmrc');
  writeFileSync(userConfig, '');
  writeFileSync(globalConfig, '');
  // Allowlist instead of inheriting npm/GH credentials, OIDC URLs/tokens, loader
  // flags, NODE_PATH, debug settings, or arbitrary package-manager configuration.
  const allowed = new Set([
    'PATH',
    'PATHEXT',
    'SYSTEMROOT',
    'SYSTEMDRIVE',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'MISE_DATA_DIR',
    'MISE_CONFIG_DIR',
    'MISE_CACHE_DIR',
    'MISE_INSTALLS_DIR',
    'XDG_DATA_HOME',
    'XDG_CONFIG_HOME',
    'XDG_CACHE_HOME',
  ]);
  toolEnv = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => allowed.has(key.toUpperCase()))
      .map(([key, value]) => [key.toUpperCase(), value])
  );
  toolEnv.PATH =
    dirname(process.execPath) + (process.platform === 'win32' ? ';' : ':') + (toolEnv.PATH ?? '');
  childEnv = {
    ...toolEnv,
    HOME: home,
    USERPROFILE: home,
    APPDATA: home,
    LOCALAPPDATA: home,
    XDG_CONFIG_HOME: home,
    XDG_CACHE_HOME: home,
    XDG_DATA_HOME: home,
    PNPM_HOME: home,
    NODE_ENV: 'development',
    CI: 'true',
    NO_COLOR: '1',
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig,
    npm_config_registry: registry,
    npm_config_ignore_scripts: 'true',
    npm_config_ignore_pnpmfile: 'true',
    npm_config_manage_package_manager_versions: 'false',
    npm_config_verify_deps_before_run: 'false',
    COREPACK_ENABLE_NETWORK: '0',
  };
}

// Log complete stdout/stderr to the owned temp directory, never environment dumps.
// Only commands whose output is asserted need an in-memory stdout copy.
async function command(label, binary, args, cwd = consumerRoot, options = {}) {
  appendFileSync(
    logPath,
    '\n=== ' + label + ' ===\n' + JSON.stringify({ binary, args, cwd }) + '\n'
  );
  return await new Promise((resolveResult, reject) => {
    const child = spawn(binary, args, {
      cwd,
      env: options.env ?? childEnv,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    child.stdout.on('data', chunk => {
      if (options.capture) stdout += chunk;
      appendFileSync(logPath, chunk);
    });
    child.stderr.on('data', chunk => appendFileSync(logPath, chunk));
    child.once('error', error => {
      appendFileSync(logPath, '\nSpawn error: ' + error.message + '\n');
      reject(new Error(label + ': ' + error.message));
    });
    child.once('close', (code, signal) => {
      appendFileSync(logPath, '\nExit: ' + code + '; signal: ' + (signal ?? 'none') + '\n');
      if (code !== 0) reject(new Error(label + ': exited ' + (code ?? signal)));
      else resolveResult(stdout);
    });
  });
}
async function stage(name, action) {
  try {
    results[name] = { ok: true, ...(await action()) };
    return true;
  } catch (error) {
    results[name] = { ok: false, error: error.message };
    appendFileSync(logPath, '\n=== Failure: ' + name + ' ===\n' + error.stack + '\n');
    return false;
  }
}
function assertManifest(manifest) {
  for (const [field, expected] of Object.entries(manifestContract)) {
    const actual = manifest[field];
    const message = 'Published compatibility field changed: ' + field;
    if (field === 'files') {
      assert.ok(Array.isArray(actual) && Array.isArray(expected), message);
      assert.deepStrictEqual(
        actual.toSorted((a, b) => a.localeCompare(b)),
        expected.toSorted((a, b) => a.localeCompare(b)),
        message
      );
    } else {
      assert.deepStrictEqual(actual, expected, message);
    }
  }
  assert.equal(
    Object.hasOwn(manifest, 'type'),
    false,
    'The package root must remain untyped CommonJS'
  );
}
function inventory(root, prefix = '') {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap(entry => {
      const path = prefix ? prefix + '/' + entry.name : entry.name;
      assert.ok(
        entry.isDirectory() || entry.isFile(),
        'Unexpected package symlink or special file: ' + path
      );
      return entry.isDirectory() ? inventory(root, path) : [path];
    })
    .sort();
}
function assertRuntimeResult(stdout, nodeVersion, mode, cases) {
  const result = JSON.parse(stdout.trim());
  assert.equal(result.node, nodeVersion, 'Consumer ran on the wrong Node version');
  assert.equal(result.mode, mode, 'Consumer checked the wrong module mode');
  assert.deepStrictEqual(
    result.cases,
    cases,
    'Consumer did not complete every required behavior check'
  );
  return { node: result.node, mode, cases: result.cases.length };
}

// Real ASL, without Task resource doubles. The Map case exercises the ESM-only
// p-limit dependency through the published CJS build on both Node generations.
const fixtures = {
  jsonPath: {
    StartAt: 'Prepare',
    States: {
      Prepare: {
        Type: 'Pass',
        InputPath: '$.payload',
        Parameters: {
          'label.$': "States.Format('{}:{}', $.name, $.n)",
          'total.$': 'States.MathAdd($.n, 2)',
          'id.$': 'States.UUID()',
          'encoded.$': 'States.Base64Encode($.name)',
          'minimum.$': 'States.MathRandom(1, 5)',
        },
        Next: 'Pause',
      },
      Pause: { Type: 'Wait', Seconds: 2, Next: 'Finish' },
      Finish: {
        Type: 'Pass',
        Parameters: { 'data.$': '$', 'entered.$': '$$.State.EnteredTime' },
        End: true,
      },
    },
  },
  jsonata: {
    QueryLanguage: 'JSONata',
    StartAt: 'Remember',
    States: {
      Remember: { Type: 'Pass', Assign: { doubled: '{% $states.input.n * 2 %}' }, Next: 'Render' },
      Render: {
        Type: 'Pass',
        End: true,
        Output:
          '{% {"total": $doubled + 1, "label": $uppercase($states.input.label), "sum": $sum($states.input.values), "id": $uuid(), "details": {"input": $states.input.n, "items": [{"value": $states.input.n}, {"value": $doubled}]}} %}',
      },
    },
  },
  map: {
    StartAt: 'Increment',
    States: {
      Increment: {
        Type: 'Map',
        ItemsPath: '$.values',
        MaxConcurrency: 2,
        End: true,
        Iterator: {
          StartAt: 'Add',
          States: {
            Add: { Type: 'Pass', Parameters: { 'value.$': 'States.MathAdd($.n, 1)' }, End: true },
          },
        },
      },
    },
  },
  parallel: {
    StartAt: 'Branches',
    States: {
      Branches: {
        Type: 'Parallel',
        End: true,
        Branches: [
          { StartAt: 'Left', States: { Left: { Type: 'Pass', Result: 'left', End: true } } },
          { StartAt: 'Right', States: { Right: { Type: 'Pass', Result: 'right', End: true } } },
        ],
      },
    },
  },
  fail: {
    StartAt: 'Reject',
    States: {
      Reject: { Type: 'Fail', Error: 'ConsumerExpectedFailure', Cause: 'Published error contract' },
    },
  },
  jsonataError: {
    QueryLanguage: 'JSONata',
    StartAt: 'Missing',
    States: {
      Missing: { Type: 'Pass', Output: '{% $states.input.missing %}', End: true },
    },
  },
};
const uuid = '00000000-0000-4000-8000-000000000000';
const jsonPathInput = { payload: { name: 'smoke', n: 7 }, untouched: true };
const jsonPathExpected = {
  data: { label: 'smoke:7', total: 9, id: uuid, encoded: 'c21va2U=', minimum: 1 },
  entered: '2025-01-01T00:00:02.000Z',
};
const jsonataInput = { n: 7, label: 'package', values: [1, 2, 3] };
const jsonataExpected = {
  total: 15,
  label: 'PACKAGE',
  sum: 6,
  id: uuid,
  details: { input: 7, items: [{ value: 7 }, { value: 14 }] },
};

function prepareConsumers() {
  writeJson(join(consumerRoot, 'fixtures.json'), {
    definitions: fixtures,
    jsonPathInput,
    jsonPathExpected,
    jsonataInput,
    jsonataExpected,
  });
  writeFileSync(
    join(consumerRoot, 'runtime-check.cjs'),
    `
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { realpathSync } = require('node:fs');
const { join } = require('node:path');
const fixture = require('./fixtures.json');
module.exports = async function check(api, mode, entrypoint) {
  for (const name of ['run', 'runState', 'createDefaultRuntime', 'createTestRuntime']) {
    assert.equal(typeof api[name], 'function', mode + ': missing public API ' + name);
  }
  const expectedEntry = join(__dirname, 'node_modules/tiny-asl-machine/lib', mode === 'require' ? 'index.js' : 'index.mjs');
  assert.equal(realpathSync(entrypoint), realpathSync(expectedEntry), mode + ': wrong export target');
  const runtime = api.createTestRuntime();
  assert.equal(runtime.now(), '2025-01-01T00:00:00.000Z');
  await runtime.sleep(1250);
  assert.equal(runtime.now(), '2025-01-01T00:00:01.250Z');
  assert.equal(runtime.randomUUID(), ${JSON.stringify(uuid)});
  assert.equal(runtime.random(3, 8), 3);
  assert.equal(runtime.base64Encode('package'), 'cGFja2FnZQ==');
  assert.equal(runtime.base64Decode('cGFja2FnZQ=='), 'package');
  assert.equal(runtime.hash('package', 'SHA-256'), createHash('sha256').update('package').digest('hex'));
  assert.throws(() => runtime.hash('package', 'NOT-A-HASH'), /Unsupported hash algorithm/);
  const overridden = api.createTestRuntime({ randomUUID: () => 'consumer-uuid' });
  assert.equal(overridden.randomUUID(), 'consumer-uuid');
  assert.equal(overridden.now(), '2025-01-01T00:00:00.000Z');
  const defaults = api.createDefaultRuntime();
  assert.equal(defaults.base64Decode(defaults.base64Encode('published')), 'published');
  assert.match(defaults.randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const inputBefore = JSON.parse(JSON.stringify(fixture.jsonPathInput));
  const jsonPath = await api.run({ definition: fixture.definitions.jsonPath, runtime: api.createTestRuntime() }, fixture.jsonPathInput);
  assert.deepStrictEqual(jsonPath, fixture.jsonPathExpected, mode + ': JSONPath/intrinsic output');
  assert.deepStrictEqual(fixture.jsonPathInput, inputBefore, mode + ': input mutated');
  const jsonata = await api.run({ definition: fixture.definitions.jsonata, runtime: api.createTestRuntime() }, fixture.jsonataInput);
  assert.deepStrictEqual(jsonata, fixture.jsonataExpected, mode + ': JSONata variables/template output');
  const map = await api.run({ definition: fixture.definitions.map, runtime: api.createTestRuntime() }, { values: [{ n: 1 }, { n: 2 }, { n: 3 }] });
  assert.deepStrictEqual(map, [{ value: 2 }, { value: 3 }, { value: 4 }], mode + ': Map concurrency/order');
  const parallel = await api.run({ definition: fixture.definitions.parallel, runtime: api.createTestRuntime() }, {});
  assert.deepStrictEqual(parallel, ['left', 'right'], mode + ': Parallel output');
  await assert.rejects(
    api.run({ definition: fixture.definitions.fail, runtime: api.createTestRuntime() }, {}),
    { name: 'ConsumerExpectedFailure', message: 'Published error contract' },
  );
  await assert.rejects(
    api.run({ definition: fixture.definitions.jsonataError, runtime: api.createTestRuntime() }, {}),
    error => error instanceof Error && error.name === 'States.QueryEvaluationError' && /evaluated to undefined/.test(error.message),
  );
  return { node: process.version, mode, cases: ['runtime-adapter', 'JSONPath-intrinsics', 'JSONata', 'Map', 'Parallel', 'Fail', 'JSONata-error'], jsonPath, jsonata, map, parallel };
};
`
  );
  writeFileSync(
    join(consumerRoot, 'consumer.cjs'),
    `
const api = require('tiny-asl-machine');
const check = require('./runtime-check.cjs');
check(api, 'require', require.resolve('tiny-asl-machine')).then(
  result => process.stdout.write(JSON.stringify(result) + '\\n'),
  error => { console.error(error); process.exitCode = 1; },
);
`
  );
  writeFileSync(
    join(consumerRoot, 'consumer.mjs'),
    `
import * as api from 'tiny-asl-machine';
import check from './runtime-check.cjs';
import { fileURLToPath } from 'node:url';
const result = await check(api, 'import', fileURLToPath(import.meta.resolve('tiny-asl-machine')));
process.stdout.write(JSON.stringify(result) + '\\n');
`
  );
  const typedBody = `
import type { StateDefinition, RuntimeAdapter, StateData, JsonataPassState } from 'tiny-asl-machine';
const jsonPath: StateDefinition = ${JSON.stringify(fixtures.jsonPath, null, 2)};
const jsonata: StateDefinition = ${JSON.stringify(fixtures.jsonata, null, 2)};
const fail: StateDefinition = ${JSON.stringify(fixtures.fail, null, 2)};

// An accidentally widened declaration must not silently make these pass.
// @ts-expect-error StartAt is required by the public definition type.
const missingStart: StateDefinition = { States: {} };
// @ts-expect-error A JSONata Pass does not accept JSONPath InputPath.
const mixedLanguages: JsonataPassState = { Type: 'Pass', InputPath: '$', End: true };
// @ts-expect-error RuntimeAdapter requires more than a clock.
const incompleteRuntime: RuntimeAdapter = { now: () => '2025-01-01T00:00:00.000Z' };
void missingStart; void mixedLanguages; void incompleteRuntime;
const executor: typeof runState = runState;
void executor;

// Compare observable JSON values and ordinary-object prototypes, not key order.
function sameJson(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false;
  if (Array.isArray(actual) && Array.isArray(expected) && actual.length !== expected.length) return false;
  const keys = Object.keys(actual);
  return keys.length === Object.keys(expected).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(expected, key) && sameJson(Reflect.get(actual, key), Reflect.get(expected, key))
  );
}

async function main(): Promise<{ cases: string[] }> {
  const runtime: RuntimeAdapter = createTestRuntime();
  const promised: Promise<StateData> = run({ definition: jsonPath, runtime }, ${JSON.stringify(jsonPathInput)});
  const result: StateData = await promised;
  if (!sameJson(result, ${JSON.stringify(jsonPathExpected)})) {
    throw new Error('Typed consumer: JSONPath/intrinsic output changed');
  }
  const output = await run({ definition: jsonata, runtime: createTestRuntime() }, ${JSON.stringify(jsonataInput)});
  if (!sameJson(output, ${JSON.stringify(jsonataExpected)})) {
    throw new Error('Typed consumer: JSONata output changed');
  }
  // @ts-expect-error The public run return type is unknown, not a number or any.
  const invalidNumber: number = output;
  void invalidNumber;
  let rejected = false;
  try {
    await run({ definition: fail, runtime: createTestRuntime() }, {});
  } catch (error: unknown) {
    if (!(error instanceof Error) || error.name !== 'ConsumerExpectedFailure' || error.message !== 'Published error contract') throw error;
    rejected = true;
  }
  if (!rejected) throw new Error('Typed consumer: Fail state resolved');
  return { cases: ['JSONPath-intrinsics', 'JSONata', 'Fail'] };
}
export const completed = main();
`;
  writeFileSync(
    join(consumerRoot, 'typed-consumer.cts'),
    `import machine = require('tiny-asl-machine');\nconst { run, runState, createTestRuntime } = machine;\n${typedBody}`
  );
  writeFileSync(
    join(consumerRoot, 'typed-consumer.mts'),
    `import { run, runState, createTestRuntime } from 'tiny-asl-machine';\n${typedBody}`
  );
  writeJson(join(consumerRoot, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      skipLibCheck: false,
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      target: 'ES2020',
      lib: ['ES2020'],
      types: [],
      typeRoots: [],
      outDir: './compiled',
      rootDir: '.',
      noEmitOnError: true,
      forceConsistentCasingInFileNames: true,
    },
    files: ['./typed-consumer.cts', './typed-consumer.mts'],
  });
}

async function main(selection) {
  let sourceManifest;
  let compilerRoot;
  let compilerLauncher;
  let compilerLibraryRoot;
  let pnpm;
  let floorNode;
  const mise = process.platform === 'win32' ? 'mise.exe' : 'mise';
  if (
    !(await stage('prerequisites', async () => {
      assert.ok(
        Number(process.versions.node.split('.')[0]) >= 22,
        'Run this script with a supported Node.js >=22 runtime'
      );
      sourceManifest = jsonFile(join(sourceRoot, 'package.json'));
      assertManifest(sourceManifest);
      if (selection.mode === 'pack') {
        for (const path of ['lib/index.js', 'lib/index.mjs', 'lib/index.d.ts']) {
          assert.ok(
            existsSync(join(sourceRoot, path)),
            'Build prerequisite missing: ' + path + '. This script will not build it.'
          );
        }
      }
      compilerRoot = realpathSync(join(sourceRoot, 'node_modules/typescript'));
      const compilerManifest = jsonFile(join(compilerRoot, 'package.json'));
      assert.match(
        compilerManifest.version,
        /^7\.\d+\.\d+$/,
        'Use the installed stable TypeScript 7 compiler'
      );
      versions.typescript = compilerManifest.version;
      compilerLauncher = resolve(compilerRoot, compilerManifest.bin.tsc);
      assert.ok(
        isWithin(compilerRoot, compilerLauncher),
        'Compiler launcher escaped its installed package'
      );
      const nativeCompilerName = '@typescript/typescript-' + process.platform + '-' + process.arch;
      assert.equal(
        compilerManifest.optionalDependencies[nativeCompilerName],
        compilerManifest.version,
        'The compiler manifest must identify the matching native platform package'
      );
      const compilerRequire = createRequire(join(compilerRoot, 'package.json'));
      const nativeManifestPath = realpathSync(
        compilerRequire.resolve(nativeCompilerName + '/package.json')
      );
      assert.equal(
        jsonFile(nativeManifestPath).version,
        compilerManifest.version,
        'Native TypeScript platform version mismatch'
      );
      compilerLibraryRoot = join(dirname(nativeManifestPath), 'lib');
      assert.ok(
        existsSync(join(compilerLibraryRoot, 'lib.es2020.d.ts')),
        'Native TypeScript standard libraries are missing'
      );
      assert.match(
        sourceManifest.packageManager,
        /^pnpm@\d+\.\d+\.\d+(?:\+.*)?$/,
        'packageManager must declare an exact pnpm version'
      );
      const expectedPnpm = sourceManifest.packageManager.slice('pnpm@'.length).split('+')[0];
      const pnpmPath =
        process.env.PNPM_BINARY ||
        process.env.npm_execpath ||
        (
          await command('Resolve project pnpm', mise, ['which', 'pnpm'], sourceRoot, {
            capture: true,
            env: toolEnv,
          })
        ).trim();
      pnpm = executable(pnpmPath, 'PNPM_BINARY');
      versions.pnpm = (
        await command('pnpm version', pnpm.binary, [...pnpm.prefix, '--version'], consumerRoot, {
          capture: true,
        })
      ).trim();
      assert.equal(versions.pnpm, expectedPnpm, 'pnpm must match the project packageManager');
      const compilerVersion = (
        await command(
          'TypeScript version',
          process.execPath,
          [compilerLauncher, '--version'],
          consumerRoot,
          { capture: true }
        )
      ).trim();
      assert.equal(
        compilerVersion,
        'Version ' + compilerManifest.version,
        'Executed compiler differs from its installed manifest'
      );
      let floorPath = process.env.FLOOR_NODE_BINARY;
      if (!floorPath) {
        let floorRoot;
        try {
          floorRoot = (
            await command(
              'Locate installed floor Node',
              mise,
              ['where', 'node@' + floorVersion],
              sourceRoot,
              { capture: true, env: toolEnv }
            )
          ).trim();
        } catch (error) {
          throw new Error(
            'Node ' +
              floorVersion +
              ' is required. Run mise install node@' +
              floorVersion +
              ' or set FLOOR_NODE_BINARY. No tool was installed.',
            { cause: error }
          );
        }
        assert.ok(
          isAbsolute(floorRoot),
          'mise returned an invalid floor Node installation directory'
        );
        floorPath = join(floorRoot, process.platform === 'win32' ? 'node.exe' : 'bin/node');
      }
      floorNode = executable(floorPath, 'FLOOR_NODE_BINARY');
      assert.equal(floorNode.prefix.length, 0, 'FLOOR_NODE_BINARY must be a real Node executable');
      versions.floorNode = (
        await command('Floor Node version', floorNode.binary, ['--version'], consumerRoot, {
          capture: true,
        })
      ).trim();
      assert.equal(
        versions.floorNode,
        'v' + floorVersion,
        'Floor Node must be exactly v' + floorVersion
      );
      return {
        node: versions.currentNode,
        floor: versions.floorNode,
        pnpm: versions.pnpm,
        typescript: versions.typescript,
      };
    }))
  )
    return;

  let dependency;
  if (
    !(await stage('package', async () => {
      if (selection.mode === 'registry') {
        dependency = selection.version;
        return { mode: selection.mode, version: selection.version, registry };
      }
      let tarball = selection.tarball;
      if (selection.mode === 'pack') {
        await command(
          'Pack built package without lifecycle hooks',
          pnpm.binary,
          [
            ...pnpm.prefix,
            '--config.ignore-scripts=true',
            '--config.ignore-pnpmfile=true',
            'pack',
            '--pack-destination',
            packRoot,
            '--json',
          ],
          sourceRoot
        );
        const tarballs = readdirSync(packRoot).filter(name => extname(name) === '.tgz');
        assert.equal(tarballs.length, 1, 'Expected one actual package tarball');
        tarball = join(packRoot, tarballs[0]);
      }
      dependency = 'file:' + tarball.replaceAll('\\', '/');
      return { mode: selection.mode, version: sourceManifest.version };
    }))
  )
    return;

  writeJson(join(consumerRoot, 'package.json'), {
    name: 'tiny-asl-machine-isolated-consumer',
    version: '0.0.0',
    private: true,
    dependencies: { 'tiny-asl-machine': dependency },
    packageManager: sourceManifest.packageManager,
  });
  // Own workspace/config boundaries even when the OS temp directory has ancestors.
  writeFileSync(join(consumerRoot, 'pnpm-workspace.yaml'), 'packages: []\n');
  writeFileSync(
    join(consumerRoot, '.npmrc'),
    'registry=' + registry + '\nignore-scripts=true\nignore-pnpmfile=true\n'
  );
  if (
    !(await stage('install', async () => {
      await command('Install real package as standalone consumer', pnpm.binary, [
        ...pnpm.prefix,
        '--ignore-workspace',
        '--config.ignore-pnpmfile=true',
        'install',
        '--ignore-scripts',
        '--no-frozen-lockfile',
        '--no-runtime',
        '--prod',
        '--registry',
        registry,
        '--store-dir',
        join(evidenceRoot, 'store'),
        '--reporter=append-only',
      ]);
      assert.equal(
        Object.hasOwn(jsonFile(join(consumerRoot, 'package.json')), 'devDependencies'),
        false
      );
      return { hooks: false, registry };
    }))
  )
    return;

  if (
    !(await stage('manifest', async () => {
      const installedRoot = realpathSync(join(consumerRoot, 'node_modules/tiny-asl-machine'));
      assert.ok(
        isWithin(consumerRoot, installedRoot),
        'Consumer must use an installed package, not a source link'
      );
      const published = jsonFile(join(installedRoot, 'package.json'));
      assertManifest(published);
      assert.equal(
        published.version,
        selection.version ?? sourceManifest.version,
        'Installed package does not match the requested version'
      );
      if (selection.mode !== 'registry') {
        assert.deepStrictEqual(
          published.dependencies,
          sourceManifest.dependencies,
          'Packed runtime dependencies differ from source'
        );
      }
      versions.package = published.version;
      const files = inventory(installedRoot);
      for (const required of [
        'lib/index.js',
        'lib/index.mjs',
        'lib/index.d.ts',
        'lib/states/index.d.ts',
        'lib/utils/runtime.d.ts',
        'types/index.d.ts',
        'types/asl.d.ts',
        'types/runtime.d.ts',
        'LICENSE',
      ])
        assert.ok(files.includes(required), 'Published required file missing: ' + required);
      assert.ok(
        files.some(path => /^skills\/[^/]+\/SKILL\.md$/.test(path)),
        'Published skills are missing'
      );
      for (const path of files) {
        assert.ok(
          /^(?:lib\/|types\/|skills\/|package\.json$|LICENSE$|README(?:\.md)?$)/i.test(path),
          'Unexpected development artifact in package: ' + path
        );
        assert.ok(
          !/(?:^|\/)(?:src|tests?|scripts|\.local|\.git|node_modules)(?:\/|$)/.test(path),
          'Development artifact leaked into package: ' + path
        );
      }
      return { version: published.version, files: files.length };
    }))
  )
    return;

  prepareConsumers();
  // Await the emitted consumers' exported promises from untyped launchers, so
  // strict typed fixtures need no ambient Node types and cannot exit unchecked.
  writeFileSync(
    join(consumerRoot, 'typed-launch.cjs'),
    "require('./compiled/typed-consumer.cjs').completed.then(result => process.stdout.write(JSON.stringify({ node: process.version, mode: 'cjs', ...result }) + '\\n'), error => { console.error(error); process.exitCode = 1; });\n"
  );
  writeFileSync(
    join(consumerRoot, 'typed-launch.mjs'),
    "import { completed } from './compiled/typed-consumer.mjs';\nconst result = await completed;\nprocess.stdout.write(JSON.stringify({ node: process.version, mode: 'mjs', ...result }) + '\\n');\n"
  );
  const runtimes = [
    ['current', process.execPath, versions.currentNode],
    ['floor', floorNode.binary, versions.floorNode],
  ];
  for (const [generation, binary, version] of runtimes) {
    for (const [mode, file] of [
      ['require', 'consumer.cjs'],
      ['import', 'consumer.mjs'],
    ]) {
      await stage(generation + '-' + mode, async () => {
        const stdout = await command(
          generation + ' ' + mode + ' runtime',
          binary,
          [join(consumerRoot, file)],
          consumerRoot,
          { capture: true }
        );
        return assertRuntimeResult(stdout, version, mode, runtimeCases);
      });
    }
  }
  if (
    !(await stage('strict-NodeNext-TS7', async () => {
      const stdout = await command(
        'Compile strict NodeNext CTS/MTS consumers',
        process.execPath,
        [compilerLauncher, '--project', join(consumerRoot, 'tsconfig.json'), '--listFiles'],
        consumerRoot,
        { capture: true }
      );
      const files = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(path => isAbsolute(path) && existsSync(path));
      assert.ok(files.length > 0, 'Compiler did not report any checked files');
      const installedDeclarations = realpathSync(
        join(consumerRoot, 'node_modules/tiny-asl-machine/lib/index.d.ts')
      );
      assert.ok(
        files.some(path => realpathSync(path) === installedDeclarations),
        'Compiler did not check the installed public declarations'
      );
      assert.ok(
        files.some(path => isWithin(compilerLibraryRoot, path)),
        'Compiler did not check its standard libraries'
      );
      for (const path of files) {
        assert.ok(
          isWithin(consumerRoot, path) ||
            isWithin(compilerRoot, path) ||
            isWithin(compilerLibraryRoot, path),
          'Declaration escaped isolated consumer/compiler: ' + path
        );
      }
      for (const extension of ['cjs', 'mjs']) {
        assert.ok(
          existsSync(join(consumerRoot, 'compiled', 'typed-consumer.' + extension)),
          'Typed consumer did not emit ' + extension
        );
      }
      return { strict: true, skipLibCheck: false, module: 'NodeNext', resolvedFiles: files.length };
    }))
  )
    return;
  for (const [generation, binary, version] of runtimes) {
    for (const extension of ['cjs', 'mjs']) {
      await stage(generation + '-typed-' + extension, async () => {
        const stdout = await command(
          generation + ' typed ' + extension + ' runtime',
          binary,
          [join(consumerRoot, 'typed-launch.' + extension)],
          consumerRoot,
          { capture: true }
        );
        return assertRuntimeResult(stdout, version, extension, typedCases);
      });
    }
  }
}

try {
  const selection = parseArguments(process.argv.slice(2));
  initializeEvidence();
  await main(selection);
  const ok = requiredStages.every(name => results[name]?.ok === true);
  const report = { ok, versions, stages: results };
  if (ok) {
    rmSync(evidenceRoot, { recursive: true });
  } else {
    report.evidence = evidenceRoot;
    report.log = logPath;
    report.missingStages = requiredStages.filter(name => !Object.hasOwn(results, name));
    writeJson(join(evidenceRoot, 'results.json'), report);
    process.exitCode = 1;
  }
  process.stdout.write(JSON.stringify(report) + '\n');
} catch (error) {
  process.exitCode = 1;
  if (logPath) {
    appendFileSync(logPath, '\n=== Orchestration failure ===\n' + error.stack + '\n');
  }
  process.stderr.write(
    JSON.stringify({
      ok: false,
      error: error.message,
      ...(evidenceRoot ? { evidence: evidenceRoot, log: logPath } : {}),
    }) + '\n'
  );
}
