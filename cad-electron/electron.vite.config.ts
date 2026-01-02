import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { existsSync, readFileSync, copyFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import copy from 'rollup-plugin-copy';

const viewerRoot = resolve(__dirname, '../viewer');
const viewerRendererPath = resolve(viewerRoot, 'renderer.js');
const viewerScenePath = resolve(viewerRoot, 'scene.json');
const rendererDest = resolve(__dirname, 'src/renderer');
const rendererOutDir = resolve(__dirname, 'out/renderer');

const createCopyTargets = (dest: string) => {
  const targets = [{ src: viewerRendererPath, dest }];
  if (existsSync(viewerScenePath)) {
    targets.push({ src: viewerScenePath, dest });
  }
  return targets;
};

const copyTargets = createCopyTargets(rendererDest);

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
 * Copy viewer assets to output directory after build completes.
 * Uses closeBundle hook to ensure files are copied AFTER Vite finishes,
 * so electron-builder includes them in the asar package.
 */
function copyViewerAssets() {
  return {
    name: 'copy-viewer-assets',
    closeBundle() {
      mkdirSync(rendererOutDir, { recursive: true });
      copyFileSync(viewerRendererPath, resolve(rendererOutDir, 'renderer.js'));
      if (existsSync(viewerScenePath)) {
        copyFileSync(viewerScenePath, resolve(rendererOutDir, 'scene.json'));
      }
    },
  };
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron'],
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [
      copy({
        targets: copyTargets,
        hook: 'buildStart',
        copySync: true,
      }),
      serveSceneJson(),
      copyViewerAssets(),
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: rendererOutDir,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
  },
});
