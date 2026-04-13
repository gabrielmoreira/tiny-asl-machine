import type { RuntimeAdapter } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeCrypto = typeof crypto !== 'undefined' ? crypto : require('crypto');

/**
 * Default runtime adapter using real Node.js APIs.
 * Used when no custom adapter is provided to `run()`.
 */
export function createDefaultRuntime(): RuntimeAdapter {
  return {
    now: () => new Date().toISOString(),
    sleep: (ms: number) => new Promise(resolve => setTimeout(() => resolve(void 0), ms)),
    randomUUID: () => nodeCrypto.randomUUID(),
    random: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
    hash: (data: string, algorithm: string) => {
      const { createHash } = require('crypto') as typeof import('crypto');
      const algoMap: Record<string, string> = {
        'MD5': 'md5',
        'SHA-1': 'sha1',
        'SHA-256': 'sha256',
        'SHA-384': 'sha384',
        'SHA-512': 'sha512',
      };
      const algo = algoMap[algorithm];
      if (!algo) throw new Error(`Unsupported hash algorithm: ${algorithm}`);
      return createHash(algo).update(data).digest('hex');
    },
    base64Encode: (data: string) => Buffer.from(data).toString('base64'),
    base64Decode: (data: string) => Buffer.from(data, 'base64').toString('utf-8'),
  };
}

/**
 * Creates a test runtime adapter with instant sleep, deterministic time,
 * and predictable random values. Override any method as needed.
 *
 * @example
 * ```typescript
 * const runtime = createTestRuntime();
 * const result = await run({ definition, runtime }, input);
 * ```
 *
 * @example
 * ```typescript
 * // Control specific behavior
 * const runtime = createTestRuntime({
 *   now: () => '2025-01-01T00:00:00.000Z',
 *   randomUUID: () => 'test-uuid-1234',
 * });
 * ```
 */
export function createTestRuntime(overrides?: Partial<RuntimeAdapter>): RuntimeAdapter {
  const defaults = createDefaultRuntime();
  let clock = new Date('2025-01-01T00:00:00.000Z').getTime();
  return {
    now: () => new Date(clock).toISOString(),
    sleep: async (ms: number) => {
      clock += ms;
    },
    randomUUID: () => '00000000-0000-4000-8000-000000000000',
    random: (min: number) => min,
    hash: defaults.hash,
    base64Encode: defaults.base64Encode,
    base64Decode: defaults.base64Decode,
    ...overrides,
  };
}
