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

  // --- Intrinsic parser: literal argument support ---
  it('supports numeric literal arguments in intrinsic functions', () => {
    const result = selectPath('States.Array($.a, 1, 2, 3)', { a: 0 }, <Context>{});
    expect(result).toStrictEqual([0, 1, 2, 3]);
  });

  it('supports negative numeric literals in intrinsic functions', () => {
    const result = selectPath('States.Array(-5, -3.14, 0)', {}, <Context>{});
    expect(result).toStrictEqual([-5, -3.14, 0]);
  });

  it('supports decimal numeric literals in intrinsic functions', () => {
    const result = selectPath('States.Array(3.14, 0.5, 100)', {}, <Context>{});
    expect(result).toStrictEqual([3.14, 0.5, 100]);
  });

  it('supports boolean literal arguments in intrinsic functions', () => {
    const result = selectPath('States.Array(true, false)', {}, <Context>{});
    expect(result).toStrictEqual([true, false]);
  });

  it('supports null literal argument in intrinsic functions', () => {
    const result = selectPath('States.Array(null, $.a, null)', { a: 1 }, <Context>{});
    expect(result).toStrictEqual([null, 1, null]);
  });

  it('supports mixed literal types in intrinsic functions', () => {
    const result = selectPath(
      "States.Array(42, true, null, 'hello', $.x)",
      { x: 'world' },
      <Context>{}
    );
    expect(result).toStrictEqual([42, true, null, 'hello', 'world']);
  });

  it('supports numeric literals in nested intrinsic calls', () => {
    const result = selectPath(
      'States.Array(1, States.Array(2, 3))',
      {},
      <Context>{}
    );
    expect(result).toStrictEqual([1, [2, 3]]);
  });

  // --- Numeric literal parser strictness (JSON number grammar) ---
  it('rejects trailing decimal point (e.g. "1.")', () => {
    expect(() => selectPath('States.Array(1.)', {}, <Context>{})).toThrow();
  });

  it('rejects leading decimal point without minus (e.g. ".5")', () => {
    expect(() => selectPath('States.Array(.5)', {}, <Context>{})).toThrow();
  });

  it('rejects leading decimal point with minus (e.g. "-.5")', () => {
    expect(() => selectPath('States.Array(-.5)', {}, <Context>{})).toThrow();
  });

  it('rejects multiple decimal points (e.g. "1.2.3")', () => {
    expect(() => selectPath('States.Array(1.2.3)', {}, <Context>{})).toThrow();
  });

  // --- Phase 2: Missing intrinsic functions ---
  // Simple value functions
  it('States.ArrayLength returns array length', () => {
    const result = selectPath('States.ArrayLength($.arr)', { arr: [1, 2, 3, 4, 5] }, <Context>{});
    expect(result).toBe(5);
  });

  it('States.ArrayLength returns 0 for empty array', () => {
    const result = selectPath('States.ArrayLength($.arr)', { arr: [] }, <Context>{});
    expect(result).toBe(0);
  });

  it('States.ArrayGetItem returns item at index', () => {
    const result = selectPath('States.ArrayGetItem($.arr, 2)', { arr: [10, 20, 30, 40] }, <Context>{});
    expect(result).toBe(30);
  });

  it('States.ArrayGetItem returns first item at index 0', () => {
    const result = selectPath('States.ArrayGetItem($.arr, 0)', { arr: ['a', 'b'] }, <Context>{});
    expect(result).toBe('a');
  });

  it('States.ArrayUnique removes duplicates', () => {
    const result = selectPath('States.ArrayUnique($.arr)', { arr: [1, 2, 3, 3, 3, 3, 4] }, <Context>{});
    expect(result).toStrictEqual([1, 2, 3, 4]);
  });

  it('States.MathAdd adds two integers', () => {
    const result = selectPath('States.MathAdd($.val, -1)', { val: 111 }, <Context>{});
    expect(result).toBe(110);
  });

  it('States.MathAdd adds with literal arguments', () => {
    const result = selectPath('States.MathAdd(5, 3)', {}, <Context>{});
    expect(result).toBe(8);
  });

  it('States.StringSplit splits string by delimiter', () => {
    const result = selectPath(
      "States.StringSplit($.str, ',')",
      { str: '1,2,3,4,5' },
      <Context>{}
    );
    expect(result).toStrictEqual(['1', '2', '3', '4', '5']);
  });

  it('States.UUID returns a valid v4 UUID', () => {
    const result = selectPath('States.UUID()', {}, <Context>{});
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  // Encoding and hashing
  it('States.Base64Encode encodes a string', () => {
    const result = selectPath("States.Base64Encode('Data to encode')", {}, <Context>{});
    expect(result).toBe('RGF0YSB0byBlbmNvZGU=');
  });

  it('States.Base64Decode decodes a string', () => {
    const result = selectPath("States.Base64Decode('RGF0YSB0byBlbmNvZGU=')", {}, <Context>{});
    expect(result).toBe('Data to encode');
  });

  it('States.Hash computes SHA-256 hash', () => {
    const result = selectPath("States.Hash('input data', 'SHA-256')", {}, <Context>{});
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('States.Hash computes MD5 hash', () => {
    const result = selectPath("States.Hash('input data', 'MD5')", {}, <Context>{});
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });

  // Array/JSON manipulation
  it('States.ArrayPartition chunks array', () => {
    const result = selectPath('States.ArrayPartition($.arr, 4)', { arr: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, <Context>{});
    expect(result).toStrictEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
  });

  it('States.ArrayRange generates range', () => {
    const result = selectPath('States.ArrayRange(1, 9, 2)', {}, <Context>{});
    expect(result).toStrictEqual([1, 3, 5, 7, 9]);
  });

  it('States.ArrayRange generates single-step range', () => {
    const result = selectPath('States.ArrayRange(1, 5, 1)', {}, <Context>{});
    expect(result).toStrictEqual([1, 2, 3, 4, 5]);
  });

  it('States.JsonMerge merges two objects (shallow)', () => {
    const result = selectPath(
      'States.JsonMerge($.a, $.b, false)',
      { a: { x: 1, y: 2 }, b: { y: 3, z: 4 } },
      <Context>{}
    );
    expect(result).toStrictEqual({ x: 1, y: 3, z: 4 });
  });

  it('States.JsonMerge merges two objects (deep)', () => {
    const result = selectPath(
      'States.JsonMerge($.a, $.b, true)',
      { a: { nested: { a1: 1, a2: 2 } }, b: { nested: { a3: 3 } } },
      <Context>{}
    );
    expect(result).toStrictEqual({ nested: { a1: 1, a2: 2, a3: 3 } });
  });

  it('States.MathRandom returns number in range', () => {
    const result = selectPath('States.MathRandom(1, 999)', {}, <Context>{}) as number;
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(999);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('States.ArrayContains uses JSON value equality for objects', () => {
    const result = selectPath(
      'States.ArrayContains($.arr, $.target)',
      { arr: [{ a: 1 }, { b: 2 }], target: { a: 1 } },
      <Context>{}
    );
    expect(result).toBe(true);
  });

  // --- Code review learnings: spec-compliance edge cases ---

  it('States.MathRandom end bound is exclusive (per ASL spec)', () => {
    // Given — run 1000 times to ensure max is never reached
    const results = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const result = selectPath('States.MathRandom(1, 5)', {}, <Context>{}) as number;
      results.add(result);
    }
    // Then — values should be 1,2,3,4 but never 5 (end-exclusive)
    expect(results.has(5)).toBe(false);
    expect(results.has(1)).toBe(true); // start is inclusive
  });

  it('States.MathAdd rounds non-integer arguments (per ASL spec)', () => {
    // Given — spec says non-integers are rounded before adding
    // Math.round(1.6) = 2, Math.round(2.7) = 3, so result = 5 (not 4.3)
    const result = selectPath('States.MathAdd($.a, $.b)', { a: 1.6, b: 2.7 }, <Context>{});
    // Then
    expect(result).toBe(5);
  });

  it('States.MathAdd returns integer even with decimal inputs', () => {
    // Given — 0.1 + 0.2 = 0.3 in float, but spec rounds first
    // Math.round(0.1) = 0, Math.round(0.2) = 0, so result = 0
    const result = selectPath('States.MathAdd($.a, $.b)', { a: 0.1, b: 0.2 }, <Context>{});
    // Then
    expect(result).toBe(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('States.StringSplit splits on each delimiter character individually', () => {
    // Given — per ASL spec, splitter is a set of delimiter characters
    const result = selectPath(
      "States.StringSplit($.str, $.delim)",
      { str: '1+2,3.4', delim: '.+,' },
      <Context>{}
    );
    // Then — splits on '.', '+', AND ',' individually
    expect(result).toStrictEqual(['1', '2', '3', '4']);
  });

  it('States.StringSplit with single char delimiter works normally', () => {
    const result = selectPath(
      "States.StringSplit($.str, ',')",
      { str: 'a,b,c' },
      <Context>{}
    );
    expect(result).toStrictEqual(['a', 'b', 'c']);
  });

  it('States.ArrayGetItem rejects out-of-range index', () => {
    expect(() =>
      selectPath('States.ArrayGetItem($.arr, 5)', { arr: [10, 20, 30] }, <Context>{})
    ).toThrow();
  });

  it('States.ArrayGetItem rejects negative index', () => {
    expect(() =>
      selectPath('States.ArrayGetItem($.arr, -1)', { arr: [10, 20, 30] }, <Context>{})
    ).toThrow();
  });

  it('States.MathRandom rejects start > end', () => {
    expect(() =>
      selectPath('States.MathRandom(10, 5)', {}, <Context>{})
    ).toThrow();
  });
});
