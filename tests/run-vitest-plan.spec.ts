import { describe, expect, it } from 'vite-plus/test';
import { buildRunVitestPlan } from '../scripts/run-vitest.ts';

describe('buildRunVitestPlan', () => {
  it('test mode runs the full suite and enables AWS only when available', () => {
    expect(
      buildRunVitestPlan([], {
        suite: 'all',
        awsMode: 'auto',
        awsAvailable: true,
      })
    ).toMatchObject({
      forwardedArgs: ['run'],
      localEnabled: true,
      awsEnabled: true,
      caseQuery: undefined,
      warnings: [],
      shouldExit: false,
    });

    expect(
      buildRunVitestPlan([], {
        suite: 'all',
        awsMode: 'auto',
        awsAvailable: false,
      })
    ).toMatchObject({
      forwardedArgs: ['run'],
      localEnabled: true,
      awsEnabled: false,
      caseQuery: undefined,
      warnings: [],
      shouldExit: false,
    });
  });

  it('test:local runs the full suite with local-only conformance', () => {
    expect(
      buildRunVitestPlan([], {
        suite: 'all',
        awsMode: 'off',
        awsAvailable: true,
      })
    ).toMatchObject({
      forwardedArgs: ['run'],
      localEnabled: true,
      awsEnabled: false,
      warnings: [],
      shouldExit: false,
    });
  });

  it('test:aws fails fast when AWS is required but unavailable', () => {
    expect(
      buildRunVitestPlan([], {
        suite: 'all',
        awsMode: 'required',
        awsAvailable: false,
      })
    ).toMatchObject({
      shouldExit: true,
      exitCode: 1,
      localEnabled: false,
      awsEnabled: false,
      errors: [
        'AWS test mode requires a deployed AWS harness with stepFunctionsRoleArn available in deployment-config.json.',
      ],
    });
  });

  it('test:conformance targets only conformance and warns when AWS is unavailable', () => {
    expect(
      buildRunVitestPlan([], {
        suite: 'conformance',
        awsMode: 'warn',
        awsAvailable: false,
      })
    ).toMatchObject({
      forwardedArgs: ['run', 'tests/conformance.spec.ts'],
      localEnabled: true,
      awsEnabled: false,
      warnings: ['AWS conformance is unavailable; running local conformance only.'],
      shouldExit: false,
    });
  });

  it('preserves case filters for any mode', () => {
    expect(
      buildRunVitestPlan(['--', '--case=group:"Feature.Catch"'], {
        suite: 'conformance',
        awsMode: 'warn',
        awsAvailable: true,
      })
    ).toMatchObject({
      forwardedArgs: ['run', 'tests/conformance.spec.ts'],
      caseQuery: 'group:"Feature.Catch"',
      localEnabled: true,
      awsEnabled: true,
      warnings: [],
      shouldExit: false,
    });
  });
});
