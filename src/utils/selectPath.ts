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

function assertArray(value: unknown, fnName: string): asserts value is unknown[] {
  if (!Array.isArray(value))
    throw new ExecutionError(
      'States.IntrinsicFailure',
      `${fnName} expected an array, got ${typeof value}`
    );
}

function assertString(value: unknown, fnName: string): asserts value is string {
  if (typeof value !== 'string')
    throw new ExecutionError(
      'States.IntrinsicFailure',
      `${fnName} expected a string, got ${typeof value}`
    );
}

function assertNumber(value: unknown, fnName: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new ExecutionError(
      'States.IntrinsicFailure',
      `${fnName} expected a number, got ${typeof value}`
    );
}

function assertInt32(value: number, fnName: string): void {
  if (value < -2147483648 || value > 2147483647)
    throw new ExecutionError(
      'States.IntrinsicFailure',
      `${fnName} expected a 32-bit signed integer, got ${value}`
    );
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
        throw new ExecutionError(
          'States.IntrinsicFailure',
          `ArrayGetItem index ${index} out of bounds for array of length ${array.length}`
        );
      return array[index];
    },
    'States.ArrayLength': (array: unknown) => {
      assertArray(array, 'States.ArrayLength');
      return array.length;
    },
    'States.ArrayPartition': (array: unknown, chunkSize: unknown) => {
      assertArray(array, 'States.ArrayPartition');
      assertNumber(chunkSize, 'States.ArrayPartition');
      const size = Math.round(chunkSize);
      if (size < 1)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'ArrayPartition chunk size must be a positive integer'
        );
      const result: unknown[][] = [];
      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }
      return result;
    },
    'States.ArrayRange': (start: unknown, end: unknown, step: unknown) => {
      assertNumber(start, 'States.ArrayRange');
      assertNumber(end, 'States.ArrayRange');
      assertNumber(step, 'States.ArrayRange');
      const s = Math.round(start);
      const e = Math.round(end);
      const st = Math.round(step);
      if (st === 0)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'ArrayRange step must not be zero'
        );
      const result: number[] = [];
      for (let i = s; st > 0 ? i <= e : i >= e; i += st) {
        result.push(i);
        if (result.length > 1000)
          throw new ExecutionError(
            'States.IntrinsicFailure',
            'ArrayRange result must not exceed 1000 items'
          );
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
    'States.Base64Encode': (str: unknown) => {
      assertString(str, 'States.Base64Encode');
      return rt.base64Encode(str);
    },
    'States.Base64Decode': (str: unknown) => {
      assertString(str, 'States.Base64Decode');
      return rt.base64Decode(str);
    },
    'States.Format': (template: string, ...args: unknown[]) => {
      return new StringTemplateParser("'" + template.trim() + "'")
        .parseTemplate()
        .map(p => (p.type === 'placeholder' ? args[p.index] : p.literal))
        .join('');
    },
    'States.Hash': (data: unknown, algorithm: unknown) => {
      assertString(data, 'States.Hash');
      assertString(algorithm, 'States.Hash');
      try {
        return rt.hash(data, algorithm);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new ExecutionError('States.IntrinsicFailure', msg);
      }
    },
    'States.JsonMerge': (obj1: unknown, obj2: unknown, isDeep: unknown) => {
      if (!obj1 || typeof obj1 !== 'object' || Array.isArray(obj1))
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'JsonMerge expected a JSON object as first argument'
        );
      if (!obj2 || typeof obj2 !== 'object' || Array.isArray(obj2))
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'JsonMerge expected a JSON object as second argument'
        );
      if (typeof isDeep !== 'boolean')
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'JsonMerge expected a boolean as third argument'
        );
      if (isDeep)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'JsonMerge deep mode is not supported'
        );
      return { ...obj1, ...obj2 };
    },
    'States.JsonToString': (obj: unknown) => JSON.stringify(obj),
    'States.MathAdd': (a: unknown, b: unknown) => {
      assertNumber(a, 'States.MathAdd');
      assertNumber(b, 'States.MathAdd');
      const x = Math.round(a);
      const y = Math.round(b);
      assertInt32(x, 'States.MathAdd');
      assertInt32(y, 'States.MathAdd');
      const result = x + y;
      assertInt32(result, 'States.MathAdd');
      return result;
    },
    'States.MathRandom': (start: unknown, end: unknown, seed?: unknown) => {
      assertNumber(start, 'States.MathRandom');
      assertNumber(end, 'States.MathRandom');
      const s = Math.round(start);
      const e = Math.round(end);
      if (s >= e)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'MathRandom start must be less than end'
        );
      if (seed !== undefined) {
        assertNumber(seed, 'States.MathRandom');
        const seedNum = Math.round(seed);
        const mod = ((seedNum * 9301 + 49297) % 233280 + 233280) % 233280;
        const hash = mod / 233280;
        return Math.floor(hash * (e - s)) + s;
      }
      return rt.random(s, e);
    },
    'States.StringSplit': (str: unknown, delimiter: unknown) => {
      assertString(str, 'States.StringSplit');
      assertString(delimiter, 'States.StringSplit');
      if (delimiter.length === 0) return [str];
      if (delimiter.length === 1) return str.split(delimiter);
      const escaped = delimiter.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&');
      return str.split(new RegExp(`[${escaped}]`)).filter(s => s.length > 0);
    },
    'States.StringToJson': (str: string) => JSON.parse(str),
    'States.UUID': () => rt.randomUUID(),
  };
}
