import { StringTemplateParser } from './parseStringTemplate';
import { describe, it, expect } from 'vitest';

describe('StringTemplateParser', () => {
  describe('basic templates', () => {
    it('parses a template with a single placeholder', () => {
      // Given
      const template = "'hello {}'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([
        { type: 'string-literal', literal: 'hello ' },
        { type: 'placeholder', index: 0 },
      ]);
    });

    it('parses a template with only text', () => {
      // Given
      const template = "'hello world'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([{ type: 'string-literal', literal: 'hello world' }]);
    });

    it('parses a template containing only a placeholder', () => {
      // Given
      const template = "'{}'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([{ type: 'placeholder', index: 0 }]);
    });
  });

  describe('multiple placeholders', () => {
    it('parses placeholders separated by literal text', () => {
      // Given
      const template = "'{} and {}'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([
        { type: 'placeholder', index: 0 },
        { type: 'string-literal', literal: ' and ' },
        { type: 'placeholder', index: 1 },
      ]);
    });

    it('parses adjacent placeholders with incrementing indexes', () => {
      // Given
      const template = "'{}{}{}'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([
        { type: 'placeholder', index: 0 },
        { type: 'placeholder', index: 1 },
        { type: 'placeholder', index: 2 },
      ]);
    });
  });

  describe('mixed literal and placeholder content', () => {
    it('parses alternating literals and placeholders', () => {
      // Given
      const template = "'Name: {}, Age: {}'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([
        { type: 'string-literal', literal: 'Name: ' },
        { type: 'placeholder', index: 0 },
        { type: 'string-literal', literal: ', Age: ' },
        { type: 'placeholder', index: 1 },
      ]);
    });
  });

  describe('escape characters', () => {
    it('treats an escaped opening brace as literal text', () => {
      // Given
      const template = "'escaped \\{ brace'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([{ type: 'string-literal', literal: 'escaped { brace' }]);
    });

    it('treats an escaped quote as literal text', () => {
      // Given
      const template = "'it\\'s'";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([{ type: 'string-literal', literal: "it's" }]);
    });
  });

  describe('edge cases', () => {
    it('returns no tokens for an empty template', () => {
      // Given
      const template = "''";
      // When
      const result = new StringTemplateParser(template).parseTemplate();
      // Then
      expect(result).toStrictEqual([]);
    });
  });

  describe('error cases', () => {
    it('throws when the closing quote is missing', () => {
      // Given
      const template = "'unterminated";
      // When / Then
      expect(() => new StringTemplateParser(template).parseTemplate()).toThrowError(
        /Invalid template: unexpected end of string/
      );
    });

    it('reports a missing opening brace for an unexpected closing brace', () => {
      // Given
      const template = "'oops }'";
      // When / Then
      expect(() => new StringTemplateParser(template).parseTemplate()).toThrowError(
        /matching '\{' not found for '\}'/
      );
    });

    it('reports a missing closing brace for an unmatched opening brace', () => {
      // Given
      const template = "'oops {'";
      // When / Then
      expect(() => new StringTemplateParser(template).parseTemplate()).toThrowError(
        /matching '\}' not found for '\{'/
      );
    });

    it('reports a missing closing brace for doubled brace ambiguity', () => {
      // Given
      const template = "'oops {{}}'";
      // When / Then
      expect(() => new StringTemplateParser(template).parseTemplate()).toThrowError(
        /matching '\}' not found for '\{'/
      );
    });
  });
});
