import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      '.vite/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'playwright/.cache/**',
      'test-results/**',
      '**/*.min.js',
    ],
  },
  {
    ...eslint.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);
