import type { Context } from '../../types';
import { selectPath } from './selectPath';
import { describe, it, expect } from 'vitest';

describe('selectPath', () => {
  it('support jsonpath expressions on input', () => {
    // Given
    const expression = '$.foo';
    const input = {
      foo: 'bar',
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual('bar');
  });
  it('support jsonpath expressions on context', () => {
    // Given
    const expression = '$$.Execution.Id';
    const input = {
      foo: 'bar',
    };
    // When
    const result = selectPath(expression, input, <Context>{
      Execution: {
        Id: 'some-id',
      },
    });
    // Then
    expect(result).toStrictEqual('some-id');
  });
  it('support intrinsic function States.StringToJson', () => {
    // Given
    const expression = 'States.StringToJson($.escapedJsonString)';
    const input = {
      escapedJsonString: '{"foo": "bar"}',
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual({ foo: 'bar' });
  });
  it('support intrinsic function States.JsonToString', () => {
    // Given
    const expression = 'States.JsonToString($.unescapedJson)';
    const input = {
      unescapedJson: {
        foo: 'bar',
      },
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual('{"foo":"bar"}');
  });
  it('support intrinsic function States.Array', () => {
    // Given
    const expression = 'States.Array($.a, $.b, $.c)';
    const input = {
      a: 1,
      b: '2',
      c: true,
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual([1, '2', true]);
  });
  it('support intrinsic function States.ArrayContains', () => {
    // Given
    const expression = 'States.ArrayContains($.inputArray, $.lookingFor)';
    const input = {
      inputArray: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      lookingFor: 5,
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual(true);
  });
  it('support intrinsic function States.ArrayContains (strings)', () => {
    // Given
    const expression = "States.ArrayContains($.inputArray, 'C')";
    const input = {
      inputArray: ['A', 'B', 'C'],
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual(true);
  });
  it('support intrinsic function States.ArrayContains (strings) returning false', () => {
    // Given
    const expression = "States.ArrayContains($.inputArray, 'D')";
    const input = {
      inputArray: ['A', 'B', 'C'],
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual(false);
  });
  it('support intrinsic function States.Format', () => {
    // Given
    const expression = `States.Format('Name: \\'{}\\', Surname: "{}"', $.name, $.surname)`;
    const input = {
      name: 'Gabriel',
      surname: 'Moreira',
    };
    // When
    const result = selectPath(expression, input, <Context>{});
    // Then
    expect(result).toStrictEqual(`Name: 'Gabriel', Surname: "Moreira"`);
  });
});
