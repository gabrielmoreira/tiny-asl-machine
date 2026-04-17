export function isJsonataString(value: unknown): value is string {
  return typeof value === 'string' && /^\s*\{%[\s\S]*%\}\s*$/.test(value);
}

export function tryExtractJsonataExpression(template: string): string | undefined {
  const match = template.match(/^\s*\{%\s*([\s\S]*?)\s*%\}\s*$/);
  return match?.[1];
}

export function extractJsonataExpression(template: string): string | undefined {
  return tryExtractJsonataExpression(template);
}
