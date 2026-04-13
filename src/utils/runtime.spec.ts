import { describe, it, expect } from 'vitest';
import { createDefaultRuntime, createTestRuntime } from './runtime';

describe('runtime adapters', () => {
  describe('createDefaultRuntime', () => {
    it('now() returns a valid ISO 8601 string', () => {
      // Given
      const runtime = createDefaultRuntime();
      // When
      const now = runtime.now();
      // Then
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Number.isNaN(Date.parse(now))).toBe(false);
      expect(new Date(now).toISOString()).toBe(now);
    });

    it('sleep() returns a promise that resolves', async () => {
      // Given
      const runtime = createDefaultRuntime();
      // When / Then
      await expect(runtime.sleep(0)).resolves.toBeUndefined();
    });

    it('randomUUID() returns a valid v4 UUID format', () => {
      // Given
      const runtime = createDefaultRuntime();
      // When
      const uuid = runtime.randomUUID();
      // Then
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('random(1, 100) returns an integer in [1, 100) (end-exclusive)', () => {
      // Given
      const runtime = createDefaultRuntime();
      // When
      const results = Array.from({ length: 500 }, () => runtime.random(1, 100));
      // Then — end-exclusive per ASL States.MathRandom spec
      for (const result of results) {
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThan(100);
      }
    });

    it("hash('data', 'SHA-256') returns a 64-character hex string", () => {
      // Given
      const runtime = createDefaultRuntime();
      // When
      const hash = runtime.hash('data', 'SHA-256');
      // Then
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe('3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7');
    });

    it("hash('data', 'INVALID') throws an error", () => {
      // Given
      const runtime = createDefaultRuntime();
      // When / Then
      expect(() => runtime.hash('data', 'INVALID')).toThrow('Unsupported hash algorithm: INVALID');
    });

    it('base64Encode() and base64Decode() preserve data in a round-trip', () => {
      // Given
      const runtime = createDefaultRuntime();
      const original = 'Hello, tiny-asl-machine! こんにちは 🚀';
      // When
      const encoded = runtime.base64Encode(original);
      const decoded = runtime.base64Decode(encoded);
      // Then
      expect(encoded).toBeTruthy();
      expect(encoded).not.toBe(original);
      expect(decoded).toBe(original);
    });
  });

  describe('createTestRuntime', () => {
    it('now() returns deterministic time starting at 2025-01-01', () => {
      // Given
      const runtime = createTestRuntime();
      // When
      const now = runtime.now();
      // Then
      expect(now).toBe('2025-01-01T00:00:00.000Z');
    });

    it('sleep(5000) advances the clock by 5 seconds', async () => {
      // Given
      const runtime = createTestRuntime();
      // When
      await runtime.sleep(5000);
      // Then
      expect(runtime.now()).toBe('2025-01-01T00:00:05.000Z');
    });

    it('randomUUID() returns a deterministic value', () => {
      // Given
      const runtime = createTestRuntime();
      // When
      const uuid = runtime.randomUUID();
      // Then
      expect(uuid).toBe('00000000-0000-4000-8000-000000000000');
    });

    it('random(min, max) returns min', () => {
      // Given
      const runtime = createTestRuntime();
      // When
      const result = runtime.random(-5, 100);
      // Then
      expect(result).toBe(-5);
    });

    it('supports method overrides', () => {
      // Given
      const runtime = createTestRuntime({
        randomUUID: () => 'custom',
      });
      // When
      const uuid = runtime.randomUUID();
      // Then
      expect(uuid).toBe('custom');
    });
  });
});