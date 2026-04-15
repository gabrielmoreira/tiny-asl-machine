import type { ConformanceCase } from './types';

export function groupCases(cases: ConformanceCase[]) {
  const grouped = new Map<string, ConformanceCase[]>();

  for (const testCase of cases) {
    const existing = grouped.get(testCase.group);
    if (existing) {
      existing.push(testCase);
      continue;
    }

    grouped.set(testCase.group, [testCase]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, groupCases]) => ({
      group,
      cases: groupCases,
    }));
}
