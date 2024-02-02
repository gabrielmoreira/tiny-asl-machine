import { StringTemplateParser } from './parseStringTemplate';

describe('xx', () => {
  it('xx', () => {
    const input = `'\\'{}abc{}x{}dsadas\\''`;
    const result = new StringTemplateParser(input).parseTemplate();
    expect(result).toStrictEqual([
      {
        literal: "'",
        type: 'string-literal',
      },
      {
        index: 0,
        type: 'placeholder',
      },
      {
        literal: 'abc',
        type: 'string-literal',
      },
      {
        index: 1,
        type: 'placeholder',
      },
      {
        literal: 'x',
        type: 'string-literal',
      },
      {
        index: 2,
        type: 'placeholder',
      },
      {
        literal: "dsadas'",
        type: 'string-literal',
      },
    ]);
  });
});
