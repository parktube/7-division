import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
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
const outputCopyTargets = createCopyTargets(rendererOutDir);

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
      copy({
        targets: outputCopyTargets,
        hook: 'writeBundle',
        copySync: true,
      }),
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
