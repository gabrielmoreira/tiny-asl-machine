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
  const intrinsics = getIntrinsicFunctions(context);
  return evaluateAst(ast, input, context, intrinsics);
}

function evaluateAst(
  ast: TopLevelIntrinsic | IntrinsicExpression,
  input: unknown,
  context: Context,
  intrinsics: Record<string, (...args: unknown[]) => unknown>
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
    const fn: any = intrinsics[ast.functionName as string];
    if (!fn)
      throw new ExecutionError(
        'InvalidIntrinsicFunction',
        `Function '${ast.functionName}' is not supported`
      );
    return fn(...ast.arguments.map(arg => evaluateAst(arg, input, context, intrinsics)));
  }
}

function evaluatePath(expression: string, input: unknown, context: Context) {
  if (expression.startsWith('$$.')) {
    return jsonpath.value(context, expression.slice(1));
  }
  return jsonpath.value(input, expression);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonValueEquals = (a: any, b: any): boolean => stableStringify(a) === stableStringify(b);

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(obj1: Record<string, unknown>, obj2: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 50) return { ...obj1, ...obj2 };
  const result: Record<string, unknown> = { ...obj1 };
  for (const [key, val] of Object.entries(obj2)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    if (
      val && typeof val === 'object' && !Array.isArray(val) &&
      result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, val as Record<string, unknown>, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function assertArray(value: unknown, fnName: string): asserts value is unknown[] {
  if (!Array.isArray(value))
    throw new ExecutionError('States.IntrinsicFailure', `${fnName} expected an array, got ${typeof value}`);
}

function assertString(value: unknown, fnName: string): asserts value is string {
  if (typeof value !== 'string')
    throw new ExecutionError('States.IntrinsicFailure', `${fnName} expected a string, got ${typeof value}`);
}

function getIntrinsicFunctions(context: Context): Record<string, (...args: unknown[]) => unknown> {
  const rt = context.Runtime ?? createDefaultRuntime();
  return {
    'States.Array': (...args: unknown[]) => [...args],
    'States.ArrayContains': (array: unknown, lookingFor: unknown) => {
      assertArray(array, 'States.ArrayContains');
      return array.some(item => jsonValueEquals(item, lookingFor));
    },
    'States.ArrayGetItem': (array: unknown, index: unknown) => {
      assertArray(array, 'States.ArrayGetItem');
      if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= array.length)
        throw new ExecutionError('States.IntrinsicFailure', `ArrayGetItem index ${index} out of bounds for array of length ${array.length}`);
      return array[index];
    },
    'States.ArrayLength': (array: unknown) => {
      assertArray(array, 'States.ArrayLength');
      return array.length;
    },
    'States.ArrayPartition': (array: unknown, chunkSize: unknown) => {
      assertArray(array, 'States.ArrayPartition');
      if (typeof chunkSize !== 'number' || !Number.isInteger(chunkSize) || chunkSize < 1)
        throw new ExecutionError('States.IntrinsicFailure', 'ArrayPartition chunk size must be a positive integer');
      const result: unknown[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
      }
      return result;
    },
    'States.ArrayRange': (start: number, end: number, step: number) => {
      if (step === 0)
        throw new ExecutionError('States.IntrinsicFailure', 'ArrayRange step must not be zero');
      const result: number[] = [];
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        result.push(i);
        if (result.length > 1000)
          throw new ExecutionError('States.IntrinsicFailure', 'ArrayRange result must not exceed 1000 items');
      }
      return result;
    },
    'States.ArrayUnique': (array: unknown) => {
      assertArray(array, 'States.ArrayUnique');
      const seen: unknown[] = [];
      for (const item of array) {
        if (!seen.some(s => jsonValueEquals(s, item))) seen.push(item);
      }
      return seen;
    },
    'States.Base64Encode': (str: string) => rt.base64Encode(str),
    'States.Base64Decode': (str: string) => rt.base64Decode(str),
    'States.Format': (template: string, ...args: unknown[]) => {
      return new StringTemplateParser("'" + template.trim() + "'")
        .parseTemplate()
        .map(p => (p.type === 'placeholder' ? args[p.index] : p.literal))
        .join('');
    },
    'States.Hash': (data: string, algorithm: string) => rt.hash(data, algorithm),
    'States.JsonMerge': (obj1: Record<string, unknown>, obj2: Record<string, unknown>, isDeep: boolean) =>
      isDeep ? deepMerge(obj1, obj2) : { ...obj1, ...obj2 },
    'States.JsonToString': (obj: unknown) => JSON.stringify(obj),
    'States.MathAdd': (a: number, b: number) => Math.round(a) + Math.round(b),
    'States.MathRandom': (start: number, end: number) => {
      const s = Math.round(start);
      const e = Math.round(end);
      if (s >= e)
        throw new ExecutionError('States.IntrinsicFailure', 'MathRandom start must be less than end');
      return rt.random(s, e);
    },
    'States.StringSplit': (str: string, delimiter: string) => {
      if (delimiter.length === 0) return [str];
      if (delimiter.length === 1) return str.split(delimiter);
      // Multi-char delimiter: split on each character individually
      const escaped = delimiter.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&');
      return str.split(new RegExp(`[${escaped}]`)).filter(s => s.length > 0);
    },
    'States.StringToJson': (str: string) => JSON.parse(str),
    'States.UUID': () => rt.randomUUID(),
  };
}