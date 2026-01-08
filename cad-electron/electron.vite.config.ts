import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { existsSync, readFileSync, cpSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';

const viewerRoot = resolve(__dirname, '../viewer');
const viewerDistPath = resolve(viewerRoot, 'dist');
const viewerScenePath = resolve(viewerRoot, 'scene.json');
const rendererOutDir = resolve(__dirname, 'out/renderer');

function serveSceneJson() {
  return {
    name: 'serve-scene-json',
    configureServer(server: { middlewares: { use: (path: string, handler: (req: unknown, res: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body?: string) => void; }) => void) => void; } }) {
      server.middlewares.use('/scene.json', (_req, res) => {
        try {
          const data = readFileSync(viewerScenePath, 'utf-8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'scene.json not found';
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

/**
 * Copy viewer/dist to out/renderer after build completes.
 * Uses closeBundle hook to ensure files are copied AFTER Vite finishes,
 * so electron-builder includes them in the asar package.
 */
function copyViewerDist() {
  return {
    name: 'copy-viewer-dist',
    closeBundle() {
      if (!existsSync(viewerDistPath)) {
        console.warn('Warning: viewer/dist not found. Run "npm run build" in viewer/ first.');
        return;
      }
      // Clean up old files first
      if (existsSync(rendererOutDir)) {
        rmSync(rendererOutDir, { recursive: true });
      }
      mkdirSync(rendererOutDir, { recursive: true });
      cpSync(viewerDistPath, rendererOutDir, { recursive: true });
      console.log('Copied viewer/dist to out/renderer');
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyViewerDist()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  // renderer config is disabled - we use viewer's Vite build instead
  // In dev mode: ELECTRON_RENDERER_URL points to viewer's dev server (localhost:5173)
  // In production: viewer/dist is copied to out/renderer
});
