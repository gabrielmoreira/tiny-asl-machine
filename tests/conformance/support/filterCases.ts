import { parse, test as liqeTest } from 'liqe';
import type { ConformanceCase } from './types';

export function filterCases(
  cases: ConformanceCase[],
  query: string | undefined
): ConformanceCase[] {
  const trimmedQuery = query?.trim();
  if (!trimmedQuery) {
    return cases;
  }

  const ast = parse(trimmedQuery);
  return cases.filter(testCase => liqeTest(ast, toSearchDocument(testCase)));
}

function toSearchDocument(testCase: ConformanceCase) {
  return {
    id: testCase.id,
    title: testCase.title,
    group: testCase.group,
    tags: testCase.tags ?? [],
  };
}
