import type { Context } from '../../types';
import jsonata from 'jsonata';
import { ExecutionError } from './executionError';
import { isJsonataString, tryExtractJsonataExpression } from './jsonataTemplate';
import { createDefaultRuntime } from './runtime';

export async function evaluateJsonataTemplateFields(
  template: unknown,
  states: {
    input: unknown;
    context: Context;
    result?: unknown;
    errorOutput?: unknown;
  },
  bindings: Record<string, unknown> = {}
): Promise<unknown> {
  if (isJsonataString(template)) {
    return await evaluateJsonataString(template, states, bindings);
  }

  if (Array.isArray(template)) {
    return await Promise.all(
      template.map(item => evaluateJsonataTemplateFields(item, states, bindings))
    );
  }

  if (template && typeof template === 'object') {
    const entries = await Promise.all(
      Object.entries(template).map(async ([key, value]) => {
        return [key, await evaluateJsonataTemplateFields(value, states, bindings)] as const;
      })
    );
    return Object.fromEntries(entries);
  }

  return template;
}

function mulberry32(seed: number): number {
  let t = ((seed + 0x6d2b79f5) | 0) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
  t = (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function registerSFJsonataFunctions(compiled: ReturnType<typeof jsonata>, context: Context): void {
  const runtime = context.Runtime ?? createDefaultRuntime();

  compiled.registerFunction(
    'partition',
    (arr: unknown, chunkSize?: number | null) => {
      if (!Array.isArray(arr)) {
        throw new Error('Argument 1 of function "partition" does not match function signature');
      }
      if (chunkSize === undefined || chunkSize === null) {
        return [arr];
      }
      const size = Math.floor(chunkSize);
      if (size === 0 || !Number.isFinite(size)) return undefined;
      if (size < 0) {
        throw new Error('D3137: Second argument must be zero or greater');
      }
      const result: unknown[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
      }
      return result;
    },
    '<jn?:a>'
  );

  compiled.registerFunction(
    'range',
    (start: number, end: number, step?: number | null) => {
      if (step === undefined || step === null) return undefined;
      const s = Math.floor(start);
      const e = Math.floor(end);
      const d = Math.floor(step);
      const result: number[] = [];
      if (!Number.isFinite(d) || d === 0) return undefined;
      if (d > 0) {
        for (let i = s; i <= e; i += d) result.push(i);
      } else {
        for (let i = s; i >= e; i += d) result.push(i);
      }
      return result;
    },
    '<nnn?:a>'
  );

  compiled.registerFunction(
    'hash',
    (data: string, algorithm: string) => runtime.hash(data, algorithm),
    '<ss:s>'
  );

  compiled.registerFunction('uuid', () => runtime.randomUUID(), '<:s>');

  compiled.registerFunction(
    'parse',
    (jsonString: string) => JSON.parse(jsonString) as unknown,
    '<s:j>'
  );

  compiled.registerFunction(
    'random',
    (seed?: number | null) => {
      if (seed === undefined || seed === null) {
        return Math.random();
      }
      return mulberry32(Math.floor(seed));
    },
    '<n?:n>'
  );
}

async function evaluateJsonataString(
  template: string,
  states: {
    input: unknown;
    context: Context;
    result?: unknown;
    errorOutput?: unknown;
  },
  bindings: Record<string, unknown>
) {
  const expression = tryExtractJsonataExpression(template);
  if (typeof expression === 'undefined') {
    return template;
  }

  try {
    const compiled = jsonata(expression);
    registerSFJsonataFunctions(compiled, states.context);
    const value = await compiled.evaluate(undefined, {
      states,
      ...bindings,
    });

    if (typeof value === 'undefined') {
      throw new ExecutionError(
        'States.QueryEvaluationError',
        `JSONata expression evaluated to undefined: ${expression}`
      );
    }

    return value;
  } catch (error) {
    if (error instanceof ExecutionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new ExecutionError(
      'States.QueryEvaluationError',
      `Failed to evaluate JSONata expression: ${expression}. ${message}`
    );
  }
}
