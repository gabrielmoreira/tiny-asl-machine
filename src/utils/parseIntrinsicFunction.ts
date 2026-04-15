// From https://github.com/aws/aws-cdk/blob/678eeded5d5631dbacff43ead697ecbd3bd4b27d/packages/%40aws-cdk/aws-stepfunctions/lib/private/intrinstics.ts
export type IntrinsicExpression =
  | StringLiteralExpression
  | NumericLiteralExpression
  | BooleanLiteralExpression
  | NullLiteralExpression
  | PathExpression
  | FnCallExpression;
export type TopLevelIntrinsic = PathExpression | FnCallExpression;

export interface StringLiteralExpression {
  readonly type: 'string-literal';
  readonly literal: string;
  readonly quoted: string;
}

export interface NumericLiteralExpression {
  readonly type: 'numeric-literal';
  readonly value: number;
}

export interface BooleanLiteralExpression {
  readonly type: 'boolean-literal';
  readonly value: boolean;
}

export interface NullLiteralExpression {
  readonly type: 'null-literal';
}

export interface PathExpression {
  readonly type: 'path';
  readonly path: string;
}

export interface FnCallExpression {
  readonly type: 'fncall';
  readonly functionName: string;
  readonly arguments: IntrinsicExpression[];
}

export type IntrinsicFunctionSignature = {
  minArgs: number;
  maxArgs: number | null;
};

export const intrinsicFunctionSignatures: Record<string, IntrinsicFunctionSignature> = {
  'States.Array': { minArgs: 0, maxArgs: null },
  'States.ArrayContains': { minArgs: 2, maxArgs: 2 },
  'States.ArrayGetItem': { minArgs: 2, maxArgs: 2 },
  'States.ArrayLength': { minArgs: 1, maxArgs: 1 },
  'States.ArrayPartition': { minArgs: 2, maxArgs: 2 },
  'States.ArrayRange': { minArgs: 3, maxArgs: 3 },
  'States.ArrayUnique': { minArgs: 1, maxArgs: 1 },
  'States.Base64Encode': { minArgs: 1, maxArgs: 1 },
  'States.Base64Decode': { minArgs: 1, maxArgs: 1 },
  'States.Format': { minArgs: 1, maxArgs: null },
  'States.Hash': { minArgs: 2, maxArgs: 2 },
  'States.JsonMerge': { minArgs: 3, maxArgs: 3 },
  'States.JsonToString': { minArgs: 1, maxArgs: 1 },
  'States.MathAdd': { minArgs: 2, maxArgs: 2 },
  'States.MathRandom': { minArgs: 2, maxArgs: 3 },
  'States.StringSplit': { minArgs: 2, maxArgs: 2 },
  'States.StringToJson': { minArgs: 1, maxArgs: 1 },
  'States.UUID': { minArgs: 0, maxArgs: null },
};

/**
 * LL(1) parser for StepFunctions intrinsics
 *
 * The parser implements a state machine over a cursor into an expression
 * string. The cusor gets moved, the character at the cursor gets inspected
 * and based on the character we accumulate some value and potentially move
 * to a different state.
 *
 * Literal strings are not allowed at the top level, but are allowed inside
 * function calls.
 */
export class IntrinsicParser {
  private i = 0;

  constructor(private readonly expression: string) {}

  public parseTopLevelIntrinsic(): TopLevelIntrinsic {
    this.ws();

    let ret: PathExpression | FnCallExpression;
    if (this.char() === '$') {
      ret = this.parsePath();
    } else if (isAlphaNum(this.char())) {
      ret = this.parseFnCall();
    } else {
      this.raiseError("expected '$' or a function call");
    }

    this.ws();

    if (!this.eof) {
      this.raiseError('unexpected trailing characters');
    }

    return ret;
  }

  private parseIntrinsic(): IntrinsicExpression {
    this.ws();

    if (this.char() === '$') {
      return this.parsePath();
    }

    if (this.char() === "'") {
      return this.parseStringLiteral();
    }

    // Numeric literals: digits or negative sign
    if (this.char() === '-' || isDigit(this.char())) {
      return this.parseNumericLiteral();
    }

    // Keywords: true, false, null, or function calls
    if (isAlphaNum(this.char())) {
      return this.parseKeywordOrFnCall();
    }

    return this.raiseError('expected $, function, string, number, boolean, or null');
  }

  private parseNumericLiteral(): NumericLiteralExpression {
    const numStr: string[] = [];

    // Optional leading minus
    if (this.char() === '-') {
      numStr.push(this.consume());
    }

    // Integer part: at least one digit required
    if (this.eof || !isDigit(this.char())) {
      this.raiseError('expected digit after minus sign');
    }
    while (!this.eof && isDigit(this.char())) {
      numStr.push(this.consume());
    }

    // Optional fractional part
    if (!this.eof && this.char() === '.') {
      numStr.push(this.consume()); // consume '.'
      // At least one digit required after decimal point
      if (this.eof || !isDigit(this.char())) {
        this.raiseError('expected digit after decimal point');
      }
      while (!this.eof && isDigit(this.char())) {
        numStr.push(this.consume());
      }
    }

    return { type: 'numeric-literal', value: Number(numStr.join('')) };
  }

  private parseKeywordOrFnCall(): IntrinsicExpression {
    // Peek ahead to see if this is a keyword (true/false/null) or a function call
    const remaining = this.expression.slice(this.i);
    if (remaining.startsWith('true') && !isAlphaNum(remaining[4] ?? '')) {
      this.i += 4;
      return { type: 'boolean-literal', value: true };
    }
    if (remaining.startsWith('false') && !isAlphaNum(remaining[5] ?? '')) {
      this.i += 5;
      return { type: 'boolean-literal', value: false };
    }
    if (remaining.startsWith('null') && !isAlphaNum(remaining[4] ?? '')) {
      this.i += 4;
      return { type: 'null-literal' };
    }
    return this.parseFnCall();
  }

  /**
   * Simplified path parsing
   *
   * JSON path can actually be quite complicated, but we don't need to validate
   * it precisely. We just need to know how far it extends.
   *
   * Therefore, we only care about:
   *
   * - Starts with a $
   * - Accept ., $ and alphanums
   * - Accept single-quoted strings ('...')
   * - Accept anything between matched square brackets ([...])
   */
  private parsePath(): PathExpression {
    const pathString = new Array<string>();
    if (this.char() !== '$') {
      this.raiseError("expected '$'");
    }
    pathString.push(this.consume());

    let done = false;
    while (!done && !this.eof) {
      switch (this.char()) {
        case '.':
        case '$':
          pathString.push(this.consume());
          break;
        case "'":
          pathString.push(this.consumeQuotedString().quoted);
          break;
        case '[':
          pathString.push(this.consumeBracketedExpression(']'));
          break;

        default:
          if (isAlphaNum(this.char())) {
            pathString.push(this.consume());
            break;
          }

          // Not alphanum, end of path expression
          done = true;
      }
    }

    return { type: 'path', path: pathString.join('') };
  }

  /**
   * Parse a fncall
   *
   * Cursor should be on call identifier. Afterwards, cursor will be on closing
   * quote.
   */
  private parseFnCall(): FnCallExpression {
    const name = new Array<string>();
    while (this.char() !== '(') {
      name.push(this.consume());
    }

    this.next(); // Consume the '('
    this.ws();

    const args = [];
    let expectingArgument = true;
    while (this.char() !== ')') {
      if (!expectingArgument) {
        this.raiseError('expected , or )');
      }

      args.push(this.parseIntrinsic());
      this.ws();
      expectingArgument = false;

      if (this.char() === ',') {
        this.next();
        this.ws();
        expectingArgument = true;
        if (this.char() === ')') {
          this.raiseError('expected argument after comma');
        }
        continue;
      } else if (this.char() === ')') {
        continue;
      }
      this.raiseError('expected , or )');
    }
    this.next(); // Consume ')'
    return {
      type: 'fncall',
      arguments: args,
      functionName: name.join(''),
    };
  }

  /**
   * Parse a string literal
   *
   * Cursor is expected to be on the first opening quote. Afterwards,
   * cursor will be after the closing quote.
   */
  private parseStringLiteral(): StringLiteralExpression {
    const { quoted, unquoted } = this.consumeQuotedString();
    return { type: 'string-literal', literal: unquoted, quoted: quoted };
  }

  /**
   * Parse a bracketed expression
   *
   * Cursor is expected to be on the opening brace. Afterwards,
   * the cursor will be after the closing brace.
   */
  private consumeBracketedExpression(closingBrace: string): string {
    const ret = new Array<string>();
    ret.push(this.consume());
    while (this.char() !== closingBrace) {
      if (this.char() === '[') {
        ret.push(this.consumeBracketedExpression(']'));
      } else if (this.char() === '{') {
        ret.push(this.consumeBracketedExpression('}'));
      } else {
        ret.push(this.consume());
      }
    }
    ret.push(this.consume());
    return ret.join('');
  }

  /**
   * Parse a string literal
   *
   * Cursor is expected to be on the first opening quote. Afterwards,
   * cursor will be after the closing quote.
   */
  private consumeQuotedString(): { readonly quoted: string; unquoted: string } {
    const quoted = new Array<string>();
    const unquoted = new Array<string>();

    quoted.push(this.consume());
    while (this.char() !== "'") {
      if (this.char() === '\\') {
        // Advance and add next character literally, whatever it is
        unquoted.push(this.char());
        quoted.push(this.consume());
      }
      quoted.push(this.char());
      unquoted.push(this.char());
      this.next();
    }
    quoted.push(this.consume());
    return { quoted: quoted.join(''), unquoted: unquoted.join('') };
  }

  /**
   * Consume whitespace if it exists
   *
   * Move the cursor to the next non-whitespace character.
   */
  private ws() {
    while (!this.eof && [' ', '\t', '\n'].includes(this.char())) {
      this.next();
    }
  }

  private get eof() {
    return this.i >= this.expression.length;
  }

  private char(): string {
    if (this.eof) {
      this.raiseError('unexpected end of string');
    }

    return this.expression[this.i];
  }

  private next() {
    this.i++;
  }

  private consume() {
    const ret = this.char();
    this.next();
    return ret;
  }

  private raiseError(message: string): never {
    throw new Error(
      `Invalid JSONPath expression: ${message} at index ${this.i} in ${JSON.stringify(
        this.expression
      )}`
    );
  }
}

function isAlphaNum(x: string) {
  return x.match(/^[a-zA-Z0-9]$/);
}

function isDigit(x: string) {
  return x >= '0' && x <= '9';
}
