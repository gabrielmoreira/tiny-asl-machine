import type { Context, QueryLanguage } from '../../types';
import deepIterator from 'deep-iterator';
import { clone } from './clone';
import { evaluateJsonataTemplateFields } from './evaluateJsonataTemplateFields';
import { isJsonataString } from './jsonataTemplate';
import { selectPath } from './selectPath';

type ReplacePathTemplateFieldsOptions = {
  queryLanguage?: QueryLanguage;
};

function isTemplateContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === 'object' && value !== null;
}

export async function replacePathTemplateFields(
  template: unknown,
  input: unknown,
  context: Context,
  result?: unknown,
  errorOutput?: unknown,
  bindings: Record<string, unknown> = {},
  options: ReplacePathTemplateFieldsOptions = {}
) {
  const queryLanguage = options.queryLanguage ?? context.StateMachine?.QueryLanguage ?? 'JSONPath';

  if (isJsonataString(template)) {
    if (queryLanguage !== 'JSONata') {
      return template;
    }

    return await evaluateJsonataTemplateFields(
      template,
      {
        input,
        context,
        result,
        errorOutput,
      },
      bindings
    );
  }

  if (!isTemplateContainer(template)) {
    return template;
  }

  const resolvedTemplate = clone(template);
  for (const { key, value, parent } of deepIterator(resolvedTemplate)) {
    if (typeof key === 'string' && key.endsWith('.$')) {
      if (typeof value !== 'string') {
        throw new TypeError(`Expected JSONPath string for template field ${key}`);
      }

      const realValue = selectPath(value, input, context);
      const realKey = key.slice(0, -2);
      parent[realKey] = realValue;
      delete parent[key];
      continue;
    }

    if (isJsonataString(value)) {
      if (queryLanguage !== 'JSONata') {
        continue;
      }

      parent[key] = await evaluateJsonataTemplateFields(
        value,
        {
          input,
          context,
          result,
          errorOutput,
        },
        bindings
      );
    }
  }
  return resolvedTemplate;
}
