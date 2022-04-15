import jsonpath from 'jsonpath';
import { Context } from '../runtime';
import { ExecutionError } from './executionError';

export function selectPath(expression: string, input: unknown, context: Context) {
  if (typeof expression !== 'string')
    throw new ExecutionError(
      'InvalidJSONPath',
      'JSON Path should be a string! Value: ' + JSON.stringify(expression)
    );
  if (expression.startsWith('$$.')) {
    return jsonpath.value(context, expression.slice(1));
  }
  return jsonpath.value(input, expression);
}
