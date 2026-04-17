import type { ResourceContext, StateData, StateDefinition } from '../../../src';
import type { RuntimeAdapter } from '../../../types/runtime';

export type TestResult = {
  output?: unknown;
  error?: string;
  cause?: string;
  meta?: Record<string, unknown>;
};

export type ConformanceExpected = (result: TestResult) => void;
export type LocalRuntimeSetup = () => Partial<RuntimeAdapter>;
// Local resource handlers intentionally allow any sync or async value because tests exercise scalar, array, object, and error-adjacent payload shapes.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type LocalResourceHandler = (payload: unknown) => unknown | Promise<unknown>;
export type LocalResourceMap = Record<string, LocalResourceHandler>;
export type LocalResourceSetup = () => LocalResourceMap | ResourceContext;

export type ConformanceCase = {
  id: string;
  title: string;
  description?: string;
  group: string;
  tags?: string[];
  definition: StateDefinition;
  input: StateData;
  expected: ConformanceExpected;
  notes?: string;
  awsExecutable?: boolean;
  localExecutable?: boolean;
  skipReason?: string;
  setupLocal?: LocalRuntimeSetup;
  setupLocalRuntime?: LocalRuntimeSetup;
  setupLocalResources?: LocalResourceSetup;
  awsObservation?: {
    includeExecutionHistory?: boolean;
  };
  source?: {
    file?: string;
    caseId?: string;
    notes?: string;
  };
};
