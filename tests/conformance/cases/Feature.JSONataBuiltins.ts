import { expect } from 'vitest';
import { customDefinitionCase } from '../support/builders';
import type { ConformanceCase, TestResult } from '../support/types';

const group = 'Feature.JSONataBuiltins';

function expectOutput(output: unknown): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    expect(result.output).toStrictEqual(output);
  };
}

function expectOutputSatisfying(check: (output: unknown) => void): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.error).toBeUndefined();
    expect(result.cause).toBeUndefined();
    check(result.output);
  };
}

function expectAnyFailure(): ConformanceCase['expected'] {
  return (result: TestResult) => {
    expect(result.output).toBeUndefined();
    expect(result.error).toEqual(expect.any(String));
    expect(result.cause).toEqual(expect.any(String));
  };
}

function expectHashShape(length: number): ConformanceCase['expected'] {
  return expectOutputSatisfying(output => {
    expect(output).toEqual(expect.any(String));
    expect(output as string).toMatch(new RegExp(`^[0-9a-f]{${length}}$`));
  });
}

export const featureJsonataBuiltinsCases: ConformanceCase[] = [
  customDefinitionCase({
    id: '001-partition-splits-array-into-chunks',
    title: '$partition([1,2,3,4,5], 2) produces [[1,2],[3,4],[5]]',
    group,
    tags: ['jsonata', 'builtin', 'partition'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3, 4, 5], size: 2 },
    expected: expectOutput([[1, 2], [3, 4], [5]]),
  }),

  customDefinitionCase({
    id: '002-range-generates-ascending-step-array',
    title: '$range(0, 10, 2) produces [0,2,4,6,8,10]',
    group,
    tags: ['jsonata', 'builtin', 'range'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(0, 10, 2) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput([0, 2, 4, 6, 8, 10]),
  }),

  customDefinitionCase({
    id: '003-hash-computes-sha256-of-string',
    title: '$hash("hello", "SHA-256") returns the known SHA-256 digest',
    group,
    tags: ['jsonata', 'builtin', 'hash'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash("hello", "SHA-256") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'),
  }),

  customDefinitionCase({
    id: '004-uuid-returns-v4-uuid-string',
    title: '$uuid() returns a v4 UUID',
    group,
    tags: ['jsonata', 'builtin', 'uuid'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $uuid() %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutputSatisfying(output => {
      expect(output).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }),
  }),

  customDefinitionCase({
    id: '005-parse-deserializes-json-string-to-object',
    title: '$parse(jsonString) deserializes to its JSON value',
    group,
    tags: ['jsonata', 'builtin', 'parse'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: '{"answer":42,"items":[1,2]}' },
    expected: expectOutput({ answer: 42, items: [1, 2] }),
  }),

  customDefinitionCase({
    id: '006-random-no-seed-returns-float-in-unit-interval',
    title: '$random() returns a float n where 0 <= n < 1',
    group,
    tags: ['jsonata', 'builtin', 'random'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $random() %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutputSatisfying(output => {
      expect(typeof output).toBe('number');
      expect(output as number).toBeGreaterThanOrEqual(0);
      expect(output as number).toBeLessThan(1);
    }),
  }),

  customDefinitionCase({
    id: '007-random-same-seed-produces-equal-values',
    title: '$random(seed) returns equal values for the same seed within the same state',
    group,
    tags: ['jsonata', 'builtin', 'random', 'seed'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: {
            r1: '{% $random(77) %}',
            r2: '{% $random(77) %}',
            equal: '{% $random(77) = $random(77) %}',
          },
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutputSatisfying(output => {
      const o = output as { r1: number; r2: number; equal: boolean };
      expect(o.r1).toBeGreaterThanOrEqual(0);
      expect(o.r1).toBeLessThan(1);
      expect(o.r1).toBe(o.r2);
      expect(o.equal).toBe(true);
    }),
  }),
  customDefinitionCase({
    id: '008-partition-fractional-chunk-size-2-6',
    title: '$partition truncates a fractional chunk size of 2.6',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3, 4, 5], size: 2.6 },
    expected: expectOutput([[1, 2], [3, 4], [5]]),
  }),
  customDefinitionCase({
    id: '009-partition-zero-chunk-size-fails',
    title: '$partition rejects a zero chunk size',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3], size: 0 },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '010-partition-negative-chunk-size-fails',
    title: '$partition rejects a negative chunk size',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3], size: -1 },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '011-partition-string-chunk-size-fails',
    title: '$partition rejects a string chunk size',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3], size: '2' },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '012-partition-null-chunk-size-fails',
    title: '$partition rejects a null chunk size',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, $states.input.size) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3], size: null },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '013-partition-non-array-first-arg-fails',
    title: '$partition rejects a non-array first argument',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, 2) %}',
          End: true,
        },
      },
    },
    input: { arr: 'not-array' },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '014-partition-missing-chunk-size-returns-single-chunk',
    title: '$partition without chunk size returns a single chunk in the observed AWS behavior',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'arity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3] },
    expected: expectOutput([[1, 2, 3]]),
  }),
  customDefinitionCase({
    id: '015-partition-extra-argument-fails',
    title: '$partition rejects an extra third argument',
    group,
    tags: ['jsonata', 'builtin', 'partition', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $partition($states.input.arr, 2, 99) %}',
          End: true,
        },
      },
    },
    input: { arr: [1, 2, 3] },
    expected: expectAnyFailure(),
  }),

  customDefinitionCase({
    id: '016-range-fractional-arguments-1-4-5-6-2-2',
    title: '$range handles fractional arguments 1.4, 5.6, 2.2',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1.4, 5.6, 2.2) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutput([1, 3, 5]),
  }),
  customDefinitionCase({
    id: '017-range-zero-step-fails',
    title: '$range rejects a zero step',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 10, 0) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '018-range-rounded-zero-step-fails',
    title: '$range rejects a step that effectively rounds toward zero',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 10, 0.49) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '019-range-over-1000-items-returns-1001-values',
    title: '$range over 1000 items returns 1001 values in the observed AWS behavior',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 1001, 1) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectOutputSatisfying(output => {
      expect(Array.isArray(output)).toBe(true);
      const values = output as number[];
      expect(values).toHaveLength(1001);
      expect(values[0]).toBe(1);
      expect(values[1000]).toBe(1001);
    }),
  }),
  customDefinitionCase({
    id: '020-range-string-start-fails',
    title: '$range rejects a string start argument',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range("a", 5, 1) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '021-range-null-step-fails',
    title: '$range rejects a null step argument',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 5, null) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '022-range-missing-argument-fails',
    title: '$range rejects a missing third argument',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 5) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '023-range-extra-argument-fails',
    title: '$range rejects an extra fourth argument',
    group,
    tags: ['jsonata', 'builtin', 'range', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $range(1, 5, 1, 99) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),

  customDefinitionCase({
    id: '024-hash-unicode-checkmark-sha256',
    title: '$hash hashes the Unicode checkmark with SHA-256',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash($states.input.s, "SHA-256") %}',
          End: true,
        },
      },
    },
    input: { s: '✓' },
    expected: expectOutput('1dabba21cdad44541f6b15796f8d22978fc7ea10c46aeceeeeb66c23b3ac7604'),
  }),
  customDefinitionCase({
    id: '025-hash-accepts-10000-char-input',
    title: '$hash accepts 10000-character input',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'aws_limit'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash($states.input.s, "SHA-256") %}',
          End: true,
        },
      },
    },
    input: { s: 'a'.repeat(10000) },
    expected: expectHashShape(64),
  }),
  customDefinitionCase({
    id: '026-hash-10001-char-input-still-succeeds',
    title: '$hash on 10001-character input still succeeds in the observed AWS behavior',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash($states.input.s, "SHA-256") %}',
          End: true,
        },
      },
    },
    input: { s: 'a'.repeat(10001) },
    expected: expectOutput('0cab99a058600ffaad1292d0c53c0548ebaf88dd1d01030345705f018a813909'),
  }),
  customDefinitionCase({
    id: '027-hash-unsupported-algorithm-fails',
    title: '$hash rejects an unsupported algorithm token',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash("data", "UNSUPPORTED") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '028-hash-lowercase-algorithm-fails',
    title: '$hash rejects a lowercase algorithm token',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash("hello", "sha-256") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '029-hash-numeric-data-argument',
    title:
      '$hash with numeric data argument follows the AWS-observed coercion or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash(123, "SHA-256") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '030-hash-missing-arguments-fails',
    title: '$hash rejects missing arguments',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash() %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '031-hash-extra-argument-fails',
    title: '$hash rejects an extra third argument',
    group,
    tags: ['jsonata', 'builtin', 'hash', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $hash("hello", "SHA-256", "extra") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),

  customDefinitionCase({
    id: '032-parse-whitespace-wrapped-object',
    title: '$parse parses JSON with surrounding whitespace',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: ' {"a":1} ' },
    expected: expectOutput({ a: 1 }),
  }),
  customDefinitionCase({
    id: '033-parse-malformed-object-fails',
    title: '$parse rejects malformed object JSON',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: '{bad json}' },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '034-parse-empty-string-fails',
    title: '$parse rejects an empty string input',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: '' },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '035-parse-numeric-input',
    title: '$parse with numeric input follows the AWS-observed coercion or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: 123 },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '036-parse-null-input',
    title: '$parse with null input follows the AWS-observed coercion or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: null },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '037-parse-object-input-fails',
    title: '$parse rejects an object input',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json) %}',
          End: true,
        },
      },
    },
    input: { json: { a: 1 } },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '038-parse-missing-argument-fails',
    title: '$parse rejects a missing argument',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse() %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '039-parse-extra-argument-fails',
    title: '$parse rejects an extra second argument',
    group,
    tags: ['jsonata', 'builtin', 'parse', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $parse($states.input.json, 1) %}',
          End: true,
        },
      },
    },
    input: { json: '{"a":1}' },
    expected: expectAnyFailure(),
  }),

  customDefinitionCase({
    id: '040-uuid-string-argument',
    title: '$uuid with a string argument follows the AWS-observed ignored-arg or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'uuid', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $uuid("x") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '041-uuid-null-argument',
    title: '$uuid with a null argument follows the AWS-observed ignored-arg or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'uuid', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $uuid(null) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '042-uuid-two-arguments',
    title: '$uuid with two arguments follows the AWS-observed ignored-arg or failure semantics',
    group,
    tags: ['jsonata', 'builtin', 'uuid', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $uuid(1, 2) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),

  customDefinitionCase({
    id: '043-random-string-seed-fails',
    title: '$random rejects a string seed',
    group,
    tags: ['jsonata', 'builtin', 'random', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $random("seed") %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '044-random-null-seed-behavior',
    title: '$random with null seed follows the AWS-observed null-seed semantics',
    group,
    tags: ['jsonata', 'builtin', 'random', 'parity', 'aws_observation'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $random(null) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '045-random-object-seed-fails',
    title: '$random rejects an object seed',
    group,
    tags: ['jsonata', 'builtin', 'random', 'parity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $random($states.input.seed) %}',
          End: true,
        },
      },
    },
    input: { seed: { bad: true } },
    expected: expectAnyFailure(),
  }),
  customDefinitionCase({
    id: '046-random-extra-argument-fails',
    title: '$random rejects an extra second argument',
    group,
    tags: ['jsonata', 'builtin', 'random', 'parity', 'arity', 'negative'],
    definition: {
      QueryLanguage: 'JSONata',
      StartAt: 'Do',
      States: {
        Do: {
          Type: 'Pass',
          Output: '{% $random(77, 88) %}',
          End: true,
        },
      },
    },
    input: {},
    expected: expectAnyFailure(),
  }),
];
