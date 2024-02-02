export type Expression = StringLiteral | Placeholder;

export interface StringLiteral {
  readonly type: 'string-literal';
  readonly literal: string;
}

export interface Placeholder {
  readonly type: 'placeholder';
  readonly index: number;
}

export class StringTemplateParser {
  private i = 0;
  private placeholders = 0;
  private tokens: Expression[] = [];

  constructor(private readonly expression: string) {}

  public parseTemplate(): Expression[] {
    if (this.char() !== "'") this.raiseError(`unexpected character "${this.char()}", expecting ' `);
    this.consume(); // skip first char '
    while (!this.eof) {
      if (this.char() === '{') {
        this.tokens.push(this.parsePlaceholder());
      } else if (this.char() === "'") {
        this.next();
        if (!this.eof)
          this.raiseError(`unexpected character "${this.char()}", expecting end of string `);
        return this.tokens;
      } else {
        this.tokens.push(this.parseStringLiteral());
      }
    }
    return this.tokens;
  }

  /**
   * Parse a string literal
   *
   * Cursor is expected to be on the first opening quote. Afterwards,
   * cursor will be after the closing quote.
   */
  private parseStringLiteral(): StringLiteral {
    const literal = this.consumeString();
    return { type: 'string-literal', literal };
  }

  /**
   * Parse a bracketed expression
   *
   * Cursor is expected to be on the opening brace. Afterwards,
   * the cursor will be after the closing brace.
   */
  private parsePlaceholder(): Placeholder {
    this.consume();
    if (this.char() !== '}') this.raiseError(`unexpected characters "${this.char()}", expecting }`);
    this.consume();
    return { type: 'placeholder', index: this.placeholders++ };
  }

  /**
   * Parse a string literal
   *
   * Cursor is expected to be on the first opening quote. Afterwards,
   * cursor will be after the closing quote.
   */
  private consumeString(): string {
    const string = new Array<string>();

    while (this.char() !== '{' && this.char() !== "'") {
      if (this.char() === '\\') {
        // Advance and add next character literally, whatever it is
        this.consume();
        string.push(this.consume());
      } else {
        string.push(this.consume());
      }
    }
    return string.join('');
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
    //console.log('Consumed char', ret, '   (next char is:', this.char(), ')');
    return ret;
  }

  private raiseError(message: string): never {
    throw new Error(
      `Invalid template: ${message} at index ${this.i} in ${JSON.stringify(this.expression)}`
    );
  }
}
