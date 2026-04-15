/* eslint-env node */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDeploymentEnv, getDeploymentConfig } from './deployment-config.ts';

const repoRoot = getDeploymentConfig().repoRoot;
const vitestBin = resolve(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');

export type RunVitestPlanOptions = {
  suite: string;
  awsMode: string;
  awsAvailable: boolean;
};

export type RunVitestPlan = {
  forwardedArgs: string[];
  caseQuery?: string;
  localEnabled: boolean;
  awsEnabled: boolean;
  warnings: string[];
  errors: string[];
  shouldExit: boolean;
  exitCode: number;
};

function main() {
  const rawArgs = process.argv.slice(2);
  const forwardedArgs: string[] = [];
  let suite = 'all';
  let awsMode = 'auto';

  for (const arg of rawArgs) {
    if (arg === '--') {
      continue;
    }

    if (arg.startsWith('--suite=')) {
      suite = arg.slice('--suite='.length);
      continue;
    }

    if (arg.startsWith('--aws-mode=')) {
      awsMode = arg.slice('--aws-mode='.length);
      continue;
    }

    if (arg === '--aws') {
      awsMode = 'required';
      continue;
    }

    if (arg === '--no-local') {
      awsMode = 'required';
      suite = 'conformance';
      continue;
    }

    forwardedArgs.push(arg);
  }

  const plan = buildRunVitestPlan(forwardedArgs, {
    suite,
    awsMode,
    awsAvailable: Boolean(getDeploymentConfig().aws.stepFunctionsRoleArn),
  });

  for (const warning of plan.warnings) {
    console.warn(warning);
  }

  for (const error of plan.errors) {
    console.error(error);
  }

  if (plan.shouldExit) {
    process.exit(plan.exitCode);
  }

  const child = spawn(
    process.execPath,
    ['--max-old-space-size=8192', vitestBin, ...plan.forwardedArgs],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...getDeploymentEnv(),
        CONFORMANCE_LOCAL: plan.localEnabled ? '1' : '0',
        CONFORMANCE_AWS: plan.awsEnabled ? '1' : '0',
        ...(plan.caseQuery ? { CONFORMANCE_CASE_QUERY: plan.caseQuery } : {}),
      },
    }
  );

  child.on('exit', code => {
    process.exit(code ?? 1);
  });

  child.on('error', error => {
    console.error(error);
    process.exit(1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export function buildRunVitestPlan(
  rawArgs: string[],
  options: RunVitestPlanOptions
): RunVitestPlan {
  const forwardedArgs: string[] = [];
  let caseQuery: string | undefined;

  for (const arg of rawArgs) {
    if (arg === '--') {
      continue;
    }

    if (arg.startsWith('--case=')) {
      caseQuery = arg.slice('--case='.length);
      continue;
    }

    forwardedArgs.push(arg);
  }

  if (forwardedArgs.length === 0) {
    forwardedArgs.push('run');
  }

  if (options.suite === 'conformance' && !forwardedArgs.includes('tests/conformance.spec.ts')) {
    forwardedArgs.push('tests/conformance.spec.ts');
  }

  if (options.suite === 'all' && forwardedArgs.length === 1 && forwardedArgs[0] !== 'run') {
    forwardedArgs.unshift('run');
  }

  if (options.awsMode === 'required' && !options.awsAvailable) {
    return {
      forwardedArgs,
      caseQuery,
      localEnabled: false,
      awsEnabled: false,
      warnings: [],
      errors: [
        'AWS test mode requires a deployed AWS harness with stepFunctionsRoleArn available in deployment-config.json.',
      ],
      shouldExit: true,
      exitCode: 1,
    };
  }

  const localEnabled = true;
  const awsEnabled =
    options.awsMode === 'off'
      ? false
      : options.awsMode === 'required'
        ? true
        : options.awsAvailable;
  const warnings =
    options.awsMode === 'warn' && !options.awsAvailable
      ? ['AWS conformance is unavailable; running local conformance only.']
      : [];

  return {
    forwardedArgs,
    caseQuery,
    localEnabled,
    awsEnabled,
    warnings,
    errors: [],
    shouldExit: false,
    exitCode: 0,
  };
}
