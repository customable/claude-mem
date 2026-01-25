import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Prevent RAM explosion - run tests sequentially
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
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
      // Coverage thresholds - will be increased as test coverage improves
      // Current baseline set after Issue #210 test suite implementation
      thresholds: {
        global: {
          statements: 15,
          branches: 15,
          functions: 15,
          lines: 15,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
