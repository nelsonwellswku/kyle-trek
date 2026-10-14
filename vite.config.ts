import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    // Modern baseline (local-only game for current browsers):
    // enables top-level await / async-await without transpilation.
    target: 'es2022',
  },
});
