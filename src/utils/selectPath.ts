import type { Context } from '../../types';
import type { IntrinsicExpression, TopLevelIntrinsic } from './parseIntrinsicFunction';
import jsonpath from 'jsonpath';
import { ExecutionError } from './executionError';
import { IntrinsicParser } from './parseIntrinsicFunction';
import { StringTemplateParser } from './parseStringTemplate';
import { createDefaultRuntime } from './runtime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectPath(expression: string, input: unknown, context: Context): any {
  if (typeof expression !== 'string')
    throw new ExecutionError(
      'InvalidJSONPath',
      'JSON Path should be a string! Value: ' + JSON.stringify(expression)
    );
  const ast = new IntrinsicParser(expression).parseTopLevelIntrinsic();
  return evaluateAst(ast, input, context);
}

function evaluateAst(
  ast: TopLevelIntrinsic | IntrinsicExpression,
  input: unknown,
  context: Context
): unknown {
  if (ast.type === 'path') {
    return evaluatePath(ast.path, input, context);
  } else if (ast.type === 'string-literal') {
    return ast.literal;
  } else if (ast.type === 'numeric-literal') {
    return ast.value;
  } else if (ast.type === 'boolean-literal') {
    return ast.value;
  } else if (ast.type === 'null-literal') {
    return null;
  } else if (ast.type === 'fncall') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn: any = getIntrinsicFunctions(context)[ast.functionName as string];
    if (!fn)
      throw new ExecutionError(
        'InvalidIntrinsicFunction',
        `Function '${ast.functionName}' is not supported`
      );
    return fn(...ast.arguments.map(arg => evaluateAst(arg, input, context)));
  }
}

function evaluatePath(expression: string, input: unknown, context: Context) {
  if (expression.startsWith('$$.')) {
    return jsonpath.value(context, expression.slice(1));
  }
  return jsonpath.value(input, expression);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonValueEquals = (a: any, b: any): boolean => JSON.stringify(a) === JSON.stringify(b);

function deepMerge(obj1: Record<string, unknown>, obj2: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj1 };
  for (const [key, val] of Object.entries(obj2)) {
    if (
      val && typeof val === 'object' && !Array.isArray(val) &&
      result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function getIntrinsicFunctions(context: Context): Record<string, (...args: unknown[]) => unknown> {
  const runtime = () => context.Runtime ?? createDefaultRuntime();
  return {
    'States.Array': (...args: unknown[]) => [...args],
    'States.ArrayContains': (array: unknown[], lookingFor: unknown) =>
      array.some(item => jsonValueEquals(item, lookingFor)),
    'States.ArrayGetItem': (array: unknown[], index: number) => array[index],
    'States.ArrayLength': (array: unknown[]) => array.length,
    'States.ArrayPartition': (array: unknown[], chunkSize: number) => {
      const result: unknown[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
      }
      return result;
    },
    'States.ArrayRange': (start: number, end: number, step: number) => {
      const result: number[] = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        result.push(i);
      }
      return result;
    },
    'States.ArrayUnique': (array: unknown[]) => {
      const seen: unknown[] = [];
      for (const item of array) {
        if (!seen.some(s => jsonValueEquals(s, item))) seen.push(item);
      }
      return seen;
    },
    'States.Base64Encode': (str: string) => runtime().base64Encode(str),
    'States.Base64Decode': (str: string) => runtime().base64Decode(str),
    'States.Format': (template: string, ...args: unknown[]) => {
      return new StringTemplateParser("'" + template.trim() + "'")
        .parseTemplate()
        .map(p => (p.type === 'placeholder' ? args[p.index] : p.literal))
        .join('');
    },
    'States.Hash': (data: string, algorithm: string) => runtime().hash(data, algorithm),
    'States.JsonMerge': (obj1: Record<string, unknown>, obj2: Record<string, unknown>, isDeep: boolean) =>
      isDeep ? deepMerge(obj1, obj2) : { ...obj1, ...obj2 },
    'States.JsonToString': (obj: unknown) => JSON.stringify(obj),
    'States.MathAdd': (a: number, b: number) => a + b,
    'States.MathRandom': (start: number, end: number) => runtime().random(start, end),
    'States.StringSplit': (str: string, delimiter: string) => str.split(delimiter),
    'States.StringToJson': (str: string) => JSON.parse(str),
    'States.UUID': () => runtime().randomUUID(),
  };
}