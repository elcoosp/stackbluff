import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['e2e/tests/**/*.spec.ts'],
    testTimeout: 120000,
    hookTimeout: 60000,
    globalSetup: ['e2e/setup/globalSetup.ts'],
    globalTeardown: ['e2e/setup/globalTeardown.ts'],
    reporters: ['verbose'],
    fileParallelism: false,
    env: {
      HEADLESS: process.env.HEADLESS ?? 'true',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
