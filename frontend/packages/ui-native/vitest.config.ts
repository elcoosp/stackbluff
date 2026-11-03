import { defineConfig } from 'vitest/config';

/**
 * Vitest config for @stackbluff/ui-native — pure-logic unit tests only
 * (tokens / geometry helpers). Node environment; no jsdom, no react-native:
 * component rendering is covered by the mobile app's jest-expo suite instead.
 *
 * NOTE (agent-07 / task 2-d): running this requires the INTEGRATOR DEP REQUEST
 * recorded in /home/z/my-project/worklog.md:
 *   ui-native: add scripts."test" = "vitest run"; devDeps: vitest
 * Until then this config and the tests are valid-but-dormant TypeScript.
 * `globals: true` pairs with __tests__/vitest-globals.d.ts so the tests also
 * typecheck (`pnpm --filter @stackbluff/ui-native check`) before vitest lands.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
});
