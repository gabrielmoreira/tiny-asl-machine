import type { Context } from '../../types';
import deepIterator from 'deep-iterator';
import { clone } from './clone';
import { evaluateJsonataTemplateFields } from './evaluateJsonataTemplateFields';
import { isJsonataString } from './jsonataTemplate';
import { selectPath } from './selectPath';

export async function replacePathTemplateFields(
  template: unknown,
  input: unknown,
  context: Context,
  result?: unknown,
  errorOutput?: unknown,
  bindings: Record<string, unknown> = {}
) {
  if (isJsonataString(template)) {
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

  const newObject = clone(template);
  for (const { key, value, parent } of deepIterator(newObject)) {
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
  return newObject;
}
