import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/features/game-setup/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    passWithNoTests: true,
  },
});
