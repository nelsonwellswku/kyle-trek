import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

function fixtureRoute(): Plugin {
  return {
    name: 'game-setup-test-fixture-route',
    configureServer(server) {
      server.middlewares.use('/__fixtures__/game-setup', async (request, response, next) => {
        const requestPath = request.url?.split('?')[0];

        if (
          (request.method !== 'GET' && request.method !== 'HEAD') ||
          (requestPath !== '/' && requestPath !== '/index.html')
        ) {
          next();
          return;
        }

        try {
          const fixtureHtml = await readFile(
            new URL('./src/features/game-setup/tests/fixtures/browser.html', import.meta.url),
            'utf8',
          );
          const transformedHtml = await server.transformIndexHtml(
            '/__fixtures__/game-setup/',
            fixtureHtml,
          );

          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(transformedHtml);
        } catch (error) {
          next(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'test' ? [fixtureRoute()] : [],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
