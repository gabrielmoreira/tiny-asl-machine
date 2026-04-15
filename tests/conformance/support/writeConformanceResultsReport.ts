import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCaseSnapshotPath, readCaseSnapshot } from './snapshotStore';
import type { ConformanceCase, TestResult } from './types';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CONFORMANCE_RESULTS_REPORT_PATH = resolve(
  PROJECT_ROOT,
  'test-reports',
  'conformance-results.md'
);

type ReportOptions = {
  caseQuery?: string;
};

type ComparedCase = {
  testCase: ConformanceCase;
  local: TestResult;
  aws: TestResult;
  localSnapshotPath: string;
  awsSnapshotPath: string;
};

type MissingSnapshotCase = {
  testCase: ConformanceCase;
  missing: Array<'local' | 'aws'>;
  localSnapshotPath: string;
  awsSnapshotPath: string;
};

export async function writeConformanceResultsReport(
  cases: ConformanceCase[],
  options: ReportOptions = {}
): Promise<void> {
  const compared: ComparedCase[] = [];
  const missingSnapshots: MissingSnapshotCase[] = [];

  for (const testCase of cases) {
    const [localSnapshot, awsSnapshot] = await Promise.all([
      readCaseSnapshot('local', testCase),
      readCaseSnapshot('aws', testCase),
    ]);

    if (!localSnapshot || !awsSnapshot) {
      const missing: Array<'local' | 'aws'> = [];
      if (!localSnapshot) {
        missing.push('local');
      }
      if (!awsSnapshot) {
        missing.push('aws');
      }

      missingSnapshots.push({
        testCase,
        missing,
        localSnapshotPath: getCaseSnapshotPath('local', testCase),
        awsSnapshotPath: getCaseSnapshotPath('aws', testCase),
      });
      continue;
    }

    compared.push({
      testCase,
      local: localSnapshot.result,
      aws: awsSnapshot.result,
      localSnapshotPath: getCaseSnapshotPath('local', testCase),
      awsSnapshotPath: getCaseSnapshotPath('aws', testCase),
    });
  }

  const mismatches = compared.filter(({ local, aws }) => !resultsMatch(local, aws));
  const matches = compared.length - mismatches.length;
  const content = renderReport({
    generatedAt: new Date().toISOString(),
    caseQuery: options.caseQuery,
    comparedCount: compared.length,
    matches,
    mismatches,
    missingSnapshots,
    comparedCases: compared,
  });

  await mkdir(dirname(CONFORMANCE_RESULTS_REPORT_PATH), { recursive: true });
  await writeFile(CONFORMANCE_RESULTS_REPORT_PATH, content);
}

function renderReport(input: {
  generatedAt: string;
  caseQuery?: string;
  comparedCount: number;
  matches: number;
  mismatches: ComparedCase[];
  missingSnapshots: MissingSnapshotCase[];
  comparedCases: ComparedCase[];
}): string {
  const mismatchRate =
    input.comparedCount === 0 ? 0 : (input.mismatches.length / input.comparedCount) * 100;

  const lines: string[] = [
    '# Conformance Results',
    '',
    `- 🕒 Generated at: ${input.generatedAt}`,
    `- 📦 Compared cases: ${input.comparedCount}`,
    `- ✅ Matches: ${input.matches}`,
    `- ❌ Mismatches: ${input.mismatches.length}`,
    `- 📭 Missing snapshots: ${input.missingSnapshots.length}`,
    `- 📉 Mismatch rate: ${mismatchRate.toFixed(2)}%`,
  ];

  if (input.caseQuery) {
    lines.push(`- Case filter: \`${input.caseQuery}\``);
  }

  lines.push('');

  if (input.mismatches.length === 0) {
    lines.push('## ✅ No mismatches', '', 'Everything that ran on both local and AWS matched.', '');
  } else {
    lines.push('## ❌ Mismatches', '');

    for (const { testCase, local, aws, localSnapshotPath, awsSnapshotPath } of input.mismatches) {
      lines.push(
        `### 🚨 ${testCase.group} / ${testCase.id}`,
        '',
        testCase.title,
        ...(testCase.description ? ['', testCase.description] : []),
        ''
      );

      lines.push(
        `**${renderResultLabel(local, 'Local result')}** ${renderSnapshotLink(localSnapshotPath, 'view snapshot')}`,
        '',
        '```json',
        serializeResult(local),
        '```',
        '',
        `**${renderResultLabel(aws, 'AWS result')}** ${renderSnapshotLink(awsSnapshotPath, 'view snapshot')}`,
        '',
        '```json',
        serializeResult(aws),
        '```',

        '---',
        ''
      );
    }
  }

  if (input.missingSnapshots.length > 0) {
    lines.push('## 📭 Missing snapshots', '');

    for (const {
      testCase,
      missing,
      localSnapshotPath,
      awsSnapshotPath,
    } of input.missingSnapshots) {
      lines.push(`- ${testCase.id} (${testCase.group}) missing: ${missing.join(', ')}`);
      lines.push(`  - Local snapshot: ${renderSnapshotLink(localSnapshotPath)}`);
      lines.push(`  - AWS snapshot: ${renderSnapshotLink(awsSnapshotPath)}`);
    }

    lines.push('');
  }

  if (input.comparedCases.length > 0) {
    lines.push('## 📚 Appendix: Compared cases', '');
    lines.push('<details>');
    lines.push(`<summary>Show all compared cases (${input.comparedCases.length})</summary>`);
    lines.push('');

    for (const { testCase, localSnapshotPath, awsSnapshotPath } of input.comparedCases) {
      lines.push(`- ${testCase.id} (${testCase.group})`);
      if (testCase.description) {
        lines.push(`  - Description: ${testCase.description}`);
      }
      lines.push(`  - Local snapshot: ${renderSnapshotLink(localSnapshotPath)}`);
      lines.push(`  - AWS snapshot: ${renderSnapshotLink(awsSnapshotPath)}`);
    }

    lines.push('', '</details>', '');
  }

  return `${lines.join('\n')}\n`;
}

function renderSnapshotLink(snapshotPath: string, label?: string): string {
  const relativePath = relative(dirname(CONFORMANCE_RESULTS_REPORT_PATH), snapshotPath).replace(
    /\\/g,
    '/'
  );
  const fileName = snapshotPath.split(/[/\\]/).at(-1) ?? snapshotPath;
  return `[${label ?? fileName}](${relativePath})`;
}

function renderResultLabel(result: TestResult, label: string): string {
  return `${resultStatusIcon(result)} ${label}`;
}

function resultStatusIcon(result: TestResult): string {
  return typeof result.error === 'undefined' ? '✅' : '❌';
}

function resultsMatch(left: TestResult, right: TestResult): boolean {
  return serializeResult(left) === serializeResult(right);
}

function serializeResult(result: TestResult): string {
  return JSON.stringify(stabilizeValue(result), null, 2);
}

function stabilizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stabilizeValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stabilizeValue(nestedValue)])
    );
  }

  return value;
}
