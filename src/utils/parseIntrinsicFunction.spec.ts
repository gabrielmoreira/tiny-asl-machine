import { describe, it, expect } from 'vitest';
import { IntrinsicParser } from './parseIntrinsicFunction';

describe('IntrinsicParser', () => {
  const parse = (expression: string) => new IntrinsicParser(expression).parseTopLevelIntrinsic();

  describe('parseTopLevelIntrinsic', () => {
    describe('path parsing', () => {
      it('parses a simple input path', () => {
        // Given
        const expression = '$.foo';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: '$.foo',
        });
      });

      it('parses a nested dot path', () => {
        // Given
        const expression = '$.a.b.c';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: '$.a.b.c',
        });
      });

      it('parses an array index path', () => {
        // Given
        const expression = '$.a[0]';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: '$.a[0]',
        });
      });

      it('parses a mixed array index and property path', () => {
        // Given
        const expression = '$.a[0].b';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: '$.a[0].b',
        });
      });

      it('parses a context path', () => {
        // Given
        const expression = '$$.Execution.Id';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: '$$.Execution.Id',
        });
      });

      it('parses bracket notation with a quoted property name', () => {
        // Given
        const expression = "$.store['book']";
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'path',
          path: "$.store['book']",
        });
      });
    });

    describe('function calls', () => {
      it('parses a function call with zero arguments', () => {
        // Given
        const expression = 'States.Array()';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [],
        });
      });

      it('parses a function call with one path argument', () => {
        // Given
        const expression = 'States.Array($.a)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'path',
              path: '$.a',
            },
          ],
        });
      });

      it('parses a function call with multiple path arguments', () => {
        // Given
        const expression = 'States.Array($.a, $.b)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'path',
              path: '$.a',
            },
            {
              type: 'path',
              path: '$.b',
            },
          ],
        });
      });

      it('parses nested function calls and literal arguments', () => {
        // Given
        const expression = 'States.Array(1, States.Array(2))';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'numeric-literal',
              value: 1,
            },
            {
              type: 'fncall',
              functionName: 'States.Array',
              arguments: [
                {
                  type: 'numeric-literal',
                  value: 2,
                },
              ],
            },
          ],
        });
      });
    });

    describe('string literals', () => {
      it('parses a string literal argument', () => {
        // Given
        const expression = "States.Array('hello')";
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'string-literal',
              literal: 'hello',
              quoted: "'hello'",
            },
          ],
        });
      });

      it('parses an escaped quote inside a string literal', () => {
        // Given
        const expression = "States.Array('it\\'s')";
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'string-literal',
              literal: "it\\'s",
              quoted: "'it\\'s'",
            },
          ],
        });
      });

      it('parses an empty string literal', () => {
        // Given
        const expression = "States.Array('')";
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'string-literal',
              literal: '',
              quoted: "''",
            },
          ],
        });
      });
    });

    describe('numeric literals', () => {
      it('parses integer numeric literals', () => {
        // Given
        const expression = 'States.Array(42, 0)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'numeric-literal',
              value: 42,
            },
            {
              type: 'numeric-literal',
              value: 0,
            },
          ],
        });
      });

      it('parses negative integer literals', () => {
        // Given
        const expression = 'States.Array(-5)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'numeric-literal',
              value: -5,
            },
          ],
        });
      });

      it('parses decimal numeric literals', () => {
        // Given
        const expression = 'States.Array(3.14)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'numeric-literal',
              value: 3.14,
            },
          ],
        });
      });

      it('parses negative decimal literals', () => {
        // Given
        const expression = 'States.Array(-3.14)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'numeric-literal',
              value: -3.14,
            },
          ],
        });
      });
    });

    describe('boolean literals', () => {
      it('parses true as a boolean literal argument', () => {
        // Given
        const expression = 'States.Array(true)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'boolean-literal',
              value: true,
            },
          ],
        });
      });

      it('parses false as a boolean literal argument', () => {
        // Given
        const expression = 'States.Array(false)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'boolean-literal',
              value: false,
            },
          ],
        });
      });
    });

    describe('null literal', () => {
      it('parses null as a null literal argument', () => {
        // Given
        const expression = 'States.Array(null)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'null-literal',
            },
          ],
        });
      });
    });

    describe('keyword vs function parsing', () => {
      it('parses trueValue(...) as a function call instead of a boolean keyword', () => {
        // Given
        const expression = 'trueValue($.a)';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'trueValue',
          arguments: [
            {
              type: 'path',
              path: '$.a',
            },
          ],
        });
      });
    });

    describe('whitespace handling', () => {
      it('parses function calls with internal whitespace around arguments', () => {
        // Given
        const expression = 'States.Array( $.a , $.b )';
        // When
        const result = parse(expression);
        // Then
        expect(result).toStrictEqual({
          type: 'fncall',
          functionName: 'States.Array',
          arguments: [
            {
              type: 'path',
              path: '$.a',
            },
            {
              type: 'path',
              path: '$.b',
            },
          ],
        });
      });
    });

    describe('error cases', () => {
      it('throws on an empty expression', () => {
        expect(() => parse('')).toThrow(/unexpected end of string/);
      });

      it('throws on an unexpected top-level character', () => {
        expect(() => parse('@')).toThrow(/expected '\$' or a function call/);
      });

      it('throws on an unterminated string literal inside a function call', () => {
        expect(() => parse("States.Array('hello)")).toThrow(/unexpected end of string/);
      });

      it('throws when a function call is missing a closing parenthesis', () => {
        expect(() => parse('States.Array(')).toThrow(/unexpected end of string/);
      });

      it('throws on trailing characters after a valid path', () => {
        expect(() => parse('$.a extra')).toThrow(/unexpected trailing characters/);
      });

      it('throws on a numeric literal with a trailing decimal point', () => {
        expect(() => parse('States.Array(1.)')).toThrow(/expected digit after decimal point/);
      });

      it('throws on a numeric literal without a digit after the minus sign', () => {
        expect(() => parse('States.Array(-.5)')).toThrow(/expected digit after minus sign/);
      });

      it('throws on an unexpected character inside function arguments', () => {
        expect(() => parse('States.Array(@)')).toThrow(
          /expected \$, function, string, number, boolean, or null/
        );
      });
    });
  });
});
