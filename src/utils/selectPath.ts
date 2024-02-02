import type { Context } from '../../types';
import type { IntrinsicExpression, TopLevelIntrinsic } from './parseIntrinsicFunction';
import jsonpath from 'jsonpath';
import { ExecutionError } from './executionError';
import { IntrinsicParser } from './parseIntrinsicFunction';
import { StringTemplateParser } from './parseStringTemplate';

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
  } else if (ast.type === 'fncall') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn: any = intrinsicFunctions[ast.functionName as keyof typeof intrinsicFunctions];
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

const intrinsicFunctions = {
  'States.ArrayContains': (array: unknown[], lookingFor: unknown) => array.includes(lookingFor),
  'States.StringToJson': (string: string) => JSON.parse(string),
  'States.JsonToString': (obj: unknown) => JSON.stringify(obj),
  'States.Array': (...args: unknown[]) => [...args],
  'States.Format': (template: string, ...args: unknown[]) => {
    return new StringTemplateParser("'" + template.trim() + "'")
      .parseTemplate()
      .map(p => {
        if (p.type === 'placeholder') {
          return args[p.index];
        } else {
          return p.literal;
        }
      })
      .join('');
  },
};
