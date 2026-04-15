import type { ChoiceRule, StateData, StateDefinition } from '../../../src';
import type { ConformanceCase, ConformanceExpected } from './types';

type BaseCaseInput = {
  id: string;
  title: string;
  description?: string;
  group: string;
  tags?: string[];
  input: StateData;
  expected: ConformanceExpected;
  notes?: string;
  awsExecutable?: boolean;
  localExecutable?: boolean;
  skipReason?: string;
  setupLocal?: ConformanceCase['setupLocal'];
  setupLocalRuntime?: ConformanceCase['setupLocalRuntime'];
  setupLocalResources?: ConformanceCase['setupLocalResources'];
  awsObservation?: ConformanceCase['awsObservation'];
  source?: ConformanceCase['source'];
};

type MatchChoiceRuleInput = {
  key: string;
  rule: ChoiceRule;
};

export function buildSingleExpressionDefinition(expression: string): StateDefinition {
  return {
    StartAt: 'Evaluate',
    States: {
      Evaluate: {
        Type: 'Pass',
        Parameters: {
          'value.$': expression,
        },
        End: true,
      },
    },
  };
}

export function buildMultiExpressionDefinition(
  expressions: Record<string, string>
): StateDefinition {
  const parameters: Record<string, unknown> = {};

  for (const [key, expression] of Object.entries(expressions)) {
    parameters[`${key}.$`] = expression;
  }

  return {
    StartAt: 'Evaluate',
    States: {
      Evaluate: {
        Type: 'Pass',
        Parameters: parameters,
        End: true,
      },
    },
  };
}

export function buildMatchChoiceDefinition(
  rules: MatchChoiceRuleInput[],
  noMatchKey?: string
): StateDefinition {
  const choices = rules.map((entry, index) => ({
    ...entry.rule,
    Next: `Matched${index}`,
  }));

  const states: StateDefinition['States'] = {
    Check: {
      Type: 'Choice',
      Choices: choices,
      ...(noMatchKey ? { Default: 'NotMatched' } : {}),
    },
  };

  for (const [index, entry] of rules.entries()) {
    states[`Matched${index}`] = {
      Type: 'Pass',
      Result: { selected: entry.key },
      End: true,
    };
  }

  if (noMatchKey) {
    states.NotMatched = {
      Type: 'Pass',
      Result: { selected: noMatchKey },
      End: true,
    };
  }

  return {
    StartAt: 'Check',
    States: states,
  };
}

export function singleExpressionCase(
  input: BaseCaseInput & {
    expression: string;
  }
): ConformanceCase {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    group: input.group,
    tags: input.tags,
    definition: buildSingleExpressionDefinition(input.expression),
    input: input.input,
    expected: input.expected,
    notes: input.notes,
    awsExecutable: input.awsExecutable,
    localExecutable: input.localExecutable,
    skipReason: input.skipReason,
    setupLocal: input.setupLocal,
    setupLocalRuntime: input.setupLocalRuntime,
    setupLocalResources: input.setupLocalResources,
    awsObservation: input.awsObservation,
    source: input.source,
  };
}

export function multiExpressionCase(
  input: BaseCaseInput & {
    expressions: Record<string, string>;
  }
): ConformanceCase {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    group: input.group,
    tags: input.tags,
    definition: buildMultiExpressionDefinition(input.expressions),
    input: input.input,
    expected: input.expected,
    notes: input.notes,
    awsExecutable: input.awsExecutable,
    localExecutable: input.localExecutable,
    skipReason: input.skipReason,
    setupLocal: input.setupLocal,
    setupLocalRuntime: input.setupLocalRuntime,
    setupLocalResources: input.setupLocalResources,
    awsObservation: input.awsObservation,
    source: input.source,
  };
}

export function customDefinitionCase(
  input: BaseCaseInput & {
    definition: StateDefinition;
  }
): ConformanceCase {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    group: input.group,
    tags: input.tags,
    definition: input.definition,
    input: input.input,
    expected: input.expected,
    notes: input.notes,
    awsExecutable: input.awsExecutable,
    localExecutable: input.localExecutable,
    skipReason: input.skipReason,
    setupLocal: input.setupLocal,
    setupLocalRuntime: input.setupLocalRuntime,
    setupLocalResources: input.setupLocalResources,
    awsObservation: input.awsObservation,
    source: input.source,
  };
}

export function matchChoiceCase(
  input: BaseCaseInput & {
    rules: MatchChoiceRuleInput[];
    noMatchKey?: string;
  }
): ConformanceCase {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    group: input.group,
    tags: input.tags,
    definition: buildMatchChoiceDefinition(input.rules, input.noMatchKey),
    input: input.input,
    expected: input.expected,
    notes: input.notes,
    awsExecutable: input.awsExecutable,
    localExecutable: input.localExecutable,
    skipReason: input.skipReason,
    setupLocal: input.setupLocal,
    setupLocalRuntime: input.setupLocalRuntime,
    setupLocalResources: input.setupLocalResources,
    awsObservation: input.awsObservation,
    source: input.source,
  };
}
