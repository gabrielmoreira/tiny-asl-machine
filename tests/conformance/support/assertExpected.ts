import { expect } from 'vitest';
import type { ConformanceExpected, TestResult } from './types';

export function assertExpected(expected: ConformanceExpected, result: TestResult) {
  expect.hasAssertions();
  expected(result);
}
