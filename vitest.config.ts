import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/features/game-setup/tests/**/*.test.ts'],
    exclude: ['src/features/game-setup/tests/**/*.spec.ts', 'node_modules/**', 'dist/**'],
    passWithNoTests: true,
  },
});
