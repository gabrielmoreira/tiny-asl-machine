import jsonpath from 'jsonpath';

export function updatePath(target: unknown, expression: string, newValue: unknown) {
  jsonpath.value(target, expression, newValue);
}
