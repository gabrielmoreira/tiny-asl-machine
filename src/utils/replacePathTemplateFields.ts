import type { Context } from '../../types';
import deepIterator from 'deep-iterator';
import { clone } from './clone';
import { selectPath } from './selectPath';

export function replacePathTemplateFields(template: unknown, input: unknown, context: Context) {
  const newObject = clone(template);
  for (const { key, value, parent } of deepIterator(newObject)) {
    if (typeof key === 'string' && key.endsWith('.$')) {
      const realValue = selectPath(value, input, context);
      const realKey = key.slice(0, -2);
      parent[realKey] = realValue;
      delete parent[key];
    }
  }
  return newObject;
}
