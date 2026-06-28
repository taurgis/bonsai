import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: [
      './tests/setup/disable-ci-color.ts',
      './tests/setup/guard-repo-mutations.ts',
    ],
    testTimeout: 30000,
    coverage: {
      provider: 'istanbul',
      reporter: ['json', 'text-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__fixtures__/**'],
      thresholds: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
      },
    },
  },
});
