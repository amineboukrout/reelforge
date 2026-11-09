import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore - plain ESM module shared with the Node server and Electron
import { createApiHandler } from './server/handler.mjs';

// Muapi does not allow browser CORS origins, so every request goes through a
// tiny local proxy. In dev we mount the same handler the production server uses.
function muapiProxy(): Plugin {
  return {
    name: 'reelforge-muapi-proxy',
    configureServer(server) {
      const handle = createApiHandler();
      server.middlewares.use((req, res, next) => {
        handle(req, res).then((handled: boolean) => {
          if (!handled) next();
        }, next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), muapiProxy()],
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
