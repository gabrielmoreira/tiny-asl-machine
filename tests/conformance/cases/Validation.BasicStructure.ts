import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Validation.BasicStructure';

function expectValidationFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toBe('VALIDATION_FAILED');
    expect(result.cause).toEqual(expect.any(String));
  };
}

function asDefinition(definition: Record<string, unknown>): ConformanceCase['definition'] {
  return definition as unknown as ConformanceCase['definition'];
}

const validationSkipReason =
  'Basic machine/state structural validation is currently enforced via AWS validation for these shapes.';

export const validationBasicStructureCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-state-missing-type-fails-validation',
    title: 'fails validation when a state omits Type',
    group,
    tags: ['validation', 'basic_structure', 'type'],
    definition: asDefinition({
      StartAt: 'First',
      States: {
        First: {
          End: true,
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '002-state-unknown-type-fails-validation',
    title: 'fails validation when a state specifies an unknown Type',
    group,
    tags: ['validation', 'basic_structure', 'type'],
    definition: asDefinition({
      StartAt: 'First',
      States: {
        First: {
          Type: 'UnknownStateType',
          End: true,
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '003-terminal-state-with-next-fails-validation',
    title: 'fails validation when a terminal state also specifies Next',
    group,
    tags: ['validation', 'basic_structure', 'terminal_state'],
    definition: asDefinition({
      StartAt: 'Done',
      States: {
        Done: {
          Type: 'Succeed',
          Next: 'AfterDone',
        },
        AfterDone: {
          Type: 'Pass',
          End: true,
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '004-nonterminal-state-missing-next-and-end-fails-validation',
    title: 'fails validation when a non-terminal state has neither Next nor End',
    group,
    tags: ['validation', 'basic_structure', 'transition'],
    definition: asDefinition({
      StartAt: 'First',
      States: {
        First: {
          Type: 'Pass',
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
  }),
  customDefinitionCase({
    id: '005-empty-states-object-fails-validation',
    title: 'fails validation when States is empty',
    group,
    tags: ['validation', 'basic_structure', 'states'],
    definition: asDefinition({
      StartAt: 'First',
      States: {},
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason: validationSkipReason,
  }),
  customDefinitionCase({
    id: '006-missing-startat-fails-validation',
    title: 'fails validation when StartAt is missing',
    group,
    tags: ['validation', 'basic_structure', 'startat'],
    definition: asDefinition({
      States: {
        First: {
          Type: 'Pass',
          End: true,
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason:
      'StartAt field presence is not explicitly checked locally; VALIDATION_FAILED is produced on AWS and only incidentally locally via unreachable-state analysis.',
  }),
  customDefinitionCase({
    id: '007-startat-target-must-exist-fails-validation',
    title: 'fails validation when StartAt references a missing state',
    group,
    tags: ['validation', 'basic_structure', 'startat'],
    definition: asDefinition({
      StartAt: 'MissingState',
      States: {
        First: {
          Type: 'Pass',
          End: true,
        },
      },
    }),
    input: {},
    expected: expectValidationFailure(),
    localExecutable: false,
    skipReason:
      'StartAt target existence is not explicitly checked locally; VALIDATION_FAILED is produced on AWS and only incidentally locally via unreachable-state analysis.',
  }),
];
