import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allConformanceCases, awsExecutableConformanceCases } from './conformance/cases';
import { assertExpected } from './conformance/support/assertExpected';
import { filterCases } from './conformance/support/filterCases';
import { groupCases } from './conformance/support/groupCases';
import {
  getAwsCaseSkipReason,
  hasAwsCaseConfig,
  runAwsCase,
} from './conformance/support/runAwsCase';
import { runLocalCase } from './conformance/support/runLocalCase';
import {
  appendExecutionLog,
  readCaseSnapshot,
  writeCaseSnapshot,
} from './conformance/support/snapshotStore';
import { writeConformanceResultsReport } from './conformance/support/writeConformanceResultsReport';

const localEnabled = process.env.CONFORMANCE_LOCAL !== '0';
const awsEnabled = process.env.CONFORMANCE_AWS === '1';
const caseQuery = process.env.CONFORMANCE_CASE_QUERY?.trim();

const selectedLocalCases = filterCases(
  allConformanceCases.filter(testCase => testCase.localExecutable !== false),
  caseQuery
);
const selectedAwsCases = filterCases(awsExecutableConformanceCases, caseQuery);

assertUniqueCaseIds(allConformanceCases);

function assertUniqueCaseIds(cases: typeof allConformanceCases) {
  const seen = new Set<string>();

  for (const testCase of cases) {
    const caseKey = `${testCase.group}::${testCase.id}`;
    if (seen.has(caseKey)) {
      throw new Error(
        `Duplicate conformance case id detected within group: ${testCase.group} / ${testCase.id}. Group + id pairs must be unique.`
      );
    }

    seen.add(caseKey);
  }
}

const AWS_LAST_RUN_LOG_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'conformance',
  'cases',
  '.snapshots',
  'aws',
  '__last_run.log'
);

const shouldWriteConformanceResultsReport = localEnabled && awsEnabled && hasAwsCaseConfig();

if (shouldWriteConformanceResultsReport) {
  afterAll(async () => {
    await writeConformanceResultsReport(selectedAwsCases, { caseQuery });
  });
}

if (!localEnabled && !awsEnabled) {
  describe('unified conformance suite', () => {
    it('requires at least one enabled runner', () => {
      throw new Error('No conformance runners selected. Remove --no-local or add --aws.');
    });
  });
} else {
  if (selectedLocalCases.length === 0 && selectedAwsCases.length === 0) {
    describe('unified conformance suite', () => {
      it('matches at least one case for the provided filter', () => {
        expect(selectedLocalCases.length + selectedAwsCases.length).toBeGreaterThan(0);
      });
    });
  }

  if (localEnabled && selectedLocalCases.length > 0) {
    describe('conformance :: local', () => {
      for (const { group, cases } of groupCases(selectedLocalCases)) {
        describe(group, () => {
          for (const testCase of cases) {
            it(`${testCase.id} :: ${testCase.title}`, async () => {
              const result = await runLocalCase(testCase);
              await writeCaseSnapshot('local', testCase, result);
              assertExpected(testCase.expected, result);
            });
          }
        });
      }
    });
  }

  if (awsEnabled && selectedAwsCases.length > 0 && !hasAwsCaseConfig()) {
    describe('conformance :: aws', () => {
      it('requires AWS configuration', () => {
        expect(getAwsCaseSkipReason()).toBe('Set AWS_SFN_ROLE_ARN to run AWS conformance tests.');
      });
    });
  } else if (awsEnabled && selectedAwsCases.length > 0) {
    describe('conformance :: aws', () => {
      for (const { group, cases } of groupCases(selectedAwsCases)) {
        describe(group, () => {
          for (const testCase of cases) {
            it.concurrent(`${testCase.id} :: ${testCase.title}`, async () => {
              const cached = await readCaseSnapshot('aws', testCase);
              if (cached) {
                await appendExecutionLog('aws', 'HIT', testCase);
              } else {
                await appendExecutionLog('aws', 'MISS', testCase);
              }
              const result = cached?.result ?? (await runAwsCase(testCase));
              if (!cached) {
                await writeCaseSnapshot('aws', testCase, result);
              }
              assertExpected(testCase.expected, result);
            }, 300_000);
          }
        });
      }
    });

    beforeAll(async () => {
      await rm(AWS_LAST_RUN_LOG_PATH, { force: true });
    });
  }
}
