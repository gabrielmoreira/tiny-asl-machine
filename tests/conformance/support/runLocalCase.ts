import { createDefaultRuntime, run, type ResourceContext } from '../../../src';
import type { ConformanceCase, LocalResourceMap, TestResult } from './types';

export async function runLocalCase(testCase: ConformanceCase): Promise<TestResult> {
  try {
    const output = await run(
      {
        definition: testCase.definition,
        runtime: {
          ...createDefaultRuntime(),
          ...testCase.setupLocal?.(),
          ...testCase.setupLocalRuntime?.(),
        },
        resourceContext: buildLocalResourceContext(testCase),
      },
      testCase.input
    );

    return { output };
  } catch (error) {
    return normalizeThrownError(error);
  }
}

function buildLocalResourceContext(testCase: ConformanceCase): ResourceContext | undefined {
  const configured = testCase.setupLocalResources?.();
  if (!configured) {
    return undefined;
  }

  if (isResourceContext(configured)) {
    return configured;
  }

  return {
    invoke: async (resource, payload) => {
      const handler = configured[resource];
      if (!handler) {
        throw new Error(`No local resource handler registered for ${resource}`);
      }

      return await handler(payload);
    },
  };
}

function isResourceContext(value: LocalResourceMap | ResourceContext): value is ResourceContext {
  return 'invoke' in value && typeof value.invoke === 'function';
}

function normalizeThrownError(error: unknown): TestResult {
  if (error instanceof Error) {
    return {
      error: error.name,
      cause: error.message,
    };
  }

  return {
    error: 'UnknownError',
    cause: String(error),
  };
}
