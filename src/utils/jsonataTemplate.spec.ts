import { describe, expect, it } from 'vitest';
import {
  extractJsonataExpression,
  isJsonataString,
  tryExtractJsonataExpression,
} from './jsonataTemplate';

describe('jsonataTemplate helpers', () => {
  it('detects JSONata wrapper strings', () => {
    expect(isJsonataString('{% $states.input %}')).toBe(true);
    expect(isJsonataString('plain text')).toBe(false);
  });

  it('returns undefined when extraction input is not a JSONata wrapper', () => {
    expect(tryExtractJsonataExpression('plain text')).toBeUndefined();
  });

  it('extracts the inner JSONata expression from a wrapped template', () => {
    expect(tryExtractJsonataExpression('{% $states.input.value %}')).toBe('$states.input.value');
    expect(extractJsonataExpression('{% $states.input.value %}')).toBe('$states.input.value');
  });
});
