import type { ChoiceRule, StateDefinition } from '../../../types';

type BuildChoiceDefinitionOptions = {
  withDefault?: boolean;
  matchedResult?: Record<string, unknown>;
  defaultResult?: Record<string, unknown>;
  matchedStateName?: string;
  defaultStateName?: string;
  checkStateName?: string;
};

export function buildChoiceDefinition(
  choice: ChoiceRule,
  options: BuildChoiceDefinitionOptions = {}
): StateDefinition {
  const withDefault = options.withDefault ?? true;
  const checkStateName = options.checkStateName ?? 'Check';
  const matchedStateName = options.matchedStateName ?? 'Matched';
  const defaultStateName = options.defaultStateName ?? 'Defaulted';
  const matchedResult = options.matchedResult ?? { branch: 'matched' };
  const defaultResult = options.defaultResult ?? { branch: 'default' };

  return {
    StartAt: checkStateName,
    States: {
      [checkStateName]: {
        Type: 'Choice',
        Choices: [{ ...choice, Next: matchedStateName }],
        ...(withDefault ? { Default: defaultStateName } : {}),
      },
      [matchedStateName]: {
        Type: 'Pass',
        Result: matchedResult,
        End: true,
      },
      ...(withDefault
        ? {
            [defaultStateName]: {
              Type: 'Pass',
              Result: defaultResult,
              End: true,
            },
          }
        : {}),
    },
  };
}
