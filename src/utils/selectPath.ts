import jsonpath from 'jsonpath';
import { Context } from '../../types/runtime';
import { ExecutionError } from './executionError';
import { IntrinsicExpression, IntrinsicParser, TopLevelIntrinsic } from './parseIntrinsicFunction';
import { StringTemplateParser } from './parseStringTemplate';

export function selectPath(expression: string, input: unknown, context: Context) {
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
) {
  if (ast.type === 'path') {
    return evaluatePath(ast.path, input, context);
  } else if (ast.type === 'string-literal') {
    return ast.literal;
  } else if (ast.type === 'fncall') {
    const fn = intrinsicFunctions[ast.functionName];
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
  'States.StringToJson': string => JSON.parse(string),
  'States.JsonToString': obj => JSON.stringify(obj),
  'States.Array': (...args) => [...args],
  'States.Format': (template, ...args) => {
    return new StringTemplateParser(template.trim())
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
