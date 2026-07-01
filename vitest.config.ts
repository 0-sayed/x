import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@materiabill/contracts': fileURLToPath(
        new URL('./packages/contracts/src/index.ts', import.meta.url),
      ),
      '@materiabill/db': fileURLToPath(new URL('./packages/db/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.e2e-spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.e2e-spec.ts'],
    },
  },
});
