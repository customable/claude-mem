import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/index.ts',
        '**/__tests__/**',
      ],
      thresholds: {
        global: {
          statements: 60,
          branches: 50,
          functions: 60,
          lines: 60,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
