/**
 * Minimal ambient typings for vitest's global API.
 *
 * vitest.config.ts sets `globals: true`, so the tests below use bare
 * describe/it/expect without importing from 'vitest'. These declarations let
 * `pnpm --filter @stackbluff/ui-native check` (tsc --noEmit) stay GREEN even
 * before the vitest devDependency is installed (see DEP REQUEST in worklog
 * task 2-d). The ui-native tsconfig pins "types": ["react", "react-native"],
 * which also prevents vitest's own globals types from double-declaring these.
 *
 * If the tests are later switched to explicit `import { describe, it, expect }
 * from 'vitest'`, delete this file.
 */
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void): void;

declare function expect(actual: unknown): VitestAssertion;

interface VitestAssertion {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeDefined(): void;
  toBeTruthy(): void;
  toContain(expected: unknown): void;
  toHaveLength(length: number): void;
}
