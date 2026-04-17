import type { Context } from '../../types';
import {
  intrinsicFunctionSignatures,
  IntrinsicParser,
  type FnCallExpression,
  type IntrinsicExpression,
  type TopLevelIntrinsic,
} from './parseIntrinsicFunction';
import jsonpath from 'jsonpath';
import { ExecutionError } from './executionError';
import { StringTemplateParser } from './parseStringTemplate';
import { createDefaultRuntime } from './runtime';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function selectPath(expression: string, input: unknown, context: Context): any {
  if (typeof expression !== 'string')
    throw new ExecutionError(
      'InvalidJSONPath',
      'JSON Path should be a string! Value: ' + JSON.stringify(expression)
    );

  try {
    const ast = new IntrinsicParser(expression).parseTopLevelIntrinsic();
    const intrinsics = getIntrinsicFunctions(context);
    return evaluateAst(ast, input, context, intrinsics);
  } catch (error) {
    if (error instanceof ExecutionError) {
      throw error;
    }

    throw new ExecutionError(
      'States.Runtime',
      `Invalid intrinsic invocation: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
    return evaluateIntrinsicCall(ast, input, context, intrinsics);
  }

  const renderedAstType = JSON.stringify((ast as { type?: unknown }).type ?? 'unknown');

  throw new ExecutionError(
    'States.Runtime',
    `Invalid intrinsic invocation: unsupported AST node type ${renderedAstType}`
  );
}

function evaluateIntrinsicCall(
  ast: FnCallExpression,
  input: unknown,
  context: Context,
  intrinsics: Record<string, (...args: unknown[]) => unknown>
): unknown {
  const fn = intrinsics[ast.functionName];
  if (typeof fn !== 'function') {
    throw new ExecutionError(
      'States.Runtime',
      `Invalid intrinsic invocation: Function '${ast.functionName}' is not supported`
    );
  }

  validateIntrinsicArity(ast);

  try {
    return fn(...ast.arguments.map(arg => evaluateAst(arg, input, context, intrinsics)));
  } catch (error) {
    throw normalizeIntrinsicInvocationError(ast, error);
  }
}

function validateIntrinsicArity(ast: FnCallExpression) {
  const signature = intrinsicFunctionSignatures[ast.functionName];
  if (!signature) {
    return;
  }

  const received = ast.arguments.length;
  const { minArgs, maxArgs } = signature;
  const hasTooFew = received < minArgs;
  const hasTooMany = maxArgs !== null && received > maxArgs;
  if (!hasTooFew && !hasTooMany) {
    return;
  }

  const expectation =
    maxArgs === null
      ? `at least ${minArgs}`
      : minArgs === maxArgs
        ? `${minArgs}`
        : `${minArgs} to ${maxArgs}`;

  throw new ExecutionError(
    'States.Runtime',
    `Invalid intrinsic invocation: ${ast.functionName} expects ${expectation} argument(s) but received ${received}.`
  );
}

function normalizeIntrinsicInvocationError(ast: FnCallExpression, error: unknown): ExecutionError {
  if (error instanceof ExecutionError) {
    if (error.name === 'States.Runtime') {
      return error;
    }

    return new ExecutionError(
      'States.Runtime',
      buildAwsStyleIntrinsicErrorMessage(ast, error.message)
    );
  }

  if (error instanceof Error) {
    return new ExecutionError(
      'States.Runtime',
      buildAwsStyleIntrinsicErrorMessage(ast, error.message)
    );
  }

  return new ExecutionError(
    'States.Runtime',
    buildAwsStyleIntrinsicErrorMessage(ast, String(error))
  );
}

function buildAwsStyleIntrinsicErrorMessage(ast: FnCallExpression, detail?: string): string {
  const base = `There was an error while evaluating the intrinsic function: ${renderIntrinsicCall(ast)}.`;
  const missingPathMatch = detail?.match(/^([^ ]+) expected a [^,]+, got undefined$/);
  if (missingPathMatch) {
    const missingPath = ast.arguments.find(argument => argument.type === 'path')?.path;
    if (missingPath) {
      return `${base} The JsonPath argument for the field '${missingPath}' could not be found in the input '{}'`;
    }
  }

  const invalidTemplateMatch = detail?.match(/^Invalid template: (.*)$/);
  if (invalidTemplateMatch) {
    return `${base} Invalid template in ${ast.functionName}: ${toAwsTemplateMessage(invalidTemplateMatch[1])}`;
  }

  if (ast.functionName === 'States.Format' && detail?.includes('template.trim is not a function')) {
    return `${base} Invalid arguments in ${ast.functionName}: number of arguments do not match the occurrences of {}.`;
  }

  if (ast.functionName === 'States.Format') {
    return `${base} Invalid arguments in ${ast.functionName}${detail ? `, caused by: ${detail}` : ''}`;
  }

  return `${base} Invalid arguments in ${ast.functionName}${detail ? `, caused by: ${detail}` : ''}`;
}

function renderIntrinsicCall(ast: FnCallExpression): string {
  return `${ast.functionName}(${ast.arguments.map(renderIntrinsicArgument).join(', ')})`;
}

function renderIntrinsicArgument(argument: IntrinsicExpression): string {
  if (argument.type === 'path') return argument.path;
  if (argument.type === 'string-literal') return argument.quoted;
  if (argument.type === 'numeric-literal') return String(argument.value);
  if (argument.type === 'boolean-literal') return String(argument.value);
  if (argument.type === 'null-literal') return 'null';
  return renderIntrinsicCall(argument);
}

function toAwsTemplateMessage(detail: string): string {
  if (detail.includes('expecting }')) {
    return "matching '}' not found for '{'.";
  }
  if (detail.includes('unexpected character "{"')) {
    return "matching '}' not found for '{'.";
  }
  return detail;
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
      const renderedIndex = typeof index === 'number' ? String(index) : JSON.stringify(index);
      if (
        typeof index !== 'number' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= array.length
      )
        throw new ExecutionError(
          'States.IntrinsicFailure',
          `ArrayGetItem index ${renderedIndex} out of bounds for array of length ${array.length}`
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
        throw new ExecutionError('States.IntrinsicFailure', 'ArrayRange step must not be zero');
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
      if (str.length > 10000)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'States.Base64Encode input must be 10000 characters or less'
        );
      return rt.base64Encode(str);
    },
    'States.Base64Decode': (str: unknown) => {
      assertString(str, 'States.Base64Decode');
      if (str.length > 10000)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'States.Base64Decode input must be 10000 characters or less'
        );
      if (str.length > 0 && (!/^[A-Za-z0-9+/=]+$/.test(str) || str.length % 4 !== 0)) {
        throw new ExecutionError('States.IntrinsicFailure', 'Invalid Base64 input');
      }
      return rt.base64Decode(str);
    },
    'States.Format': (template: unknown, ...args: unknown[]) => {
      assertString(template, 'States.Format');
      const parsed = new StringTemplateParser("'" + template + "'").parseTemplate();
      const placeholderCount = parsed.filter(part => part.type === 'placeholder').length;
      if (placeholderCount !== args.length) {
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'Invalid arguments in States.Format: number of arguments do not match the occurrences of {}.'
        );
      }
      const renderFormatArg = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
          return String(value);
        }
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'undefined' || value === null) return '';
        return JSON.stringify(value);
      };
      return parsed
        .map(p => (p.type === 'placeholder' ? renderFormatArg(args[p.index]) : p.literal))
        .join('');
    },
    'States.Hash': (data: unknown, algorithm: unknown) => {
      assertString(data, 'States.Hash');
      if (data.length > 10000)
        throw new ExecutionError(
          'States.IntrinsicFailure',
          'States.Hash input must be 10000 characters or less'
        );
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
        throw new ExecutionError('States.IntrinsicFailure', 'JsonMerge deep mode is not supported');
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
        const mod = (((seedNum * 9301 + 49297) % 233280) + 233280) % 233280;
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
      // Current local behavior treats multi-character delimiters as a delimiter-character set.
      // This is pinned by the existing conformance/spec tests and may diverge from AWS semantics.
      const escaped = delimiter.replace(/[-.*+?^${}()|[\]\\]/g, '\\$&');
      return str.split(new RegExp(`[${escaped}]`)).filter(s => s.length > 0);
    },
    'States.StringToJson': (str: unknown) => {
      assertString(str, 'States.StringToJson');
      return JSON.parse(str);
    },
    'States.UUID': () => rt.randomUUID(),
  };
}
