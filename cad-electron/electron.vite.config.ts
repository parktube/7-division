import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import copy from 'rollup-plugin-copy';

const viewerRoot = resolve(__dirname, '../viewer');
const viewerRendererPath = resolve(viewerRoot, 'renderer.js');
const viewerScenePath = resolve(viewerRoot, 'scene.json');
const rendererDest = resolve(__dirname, 'src/renderer');
const rendererOutDir = resolve(__dirname, 'out/renderer');

const copyTargets = [
  { src: viewerRendererPath, dest: rendererDest },
];

if (existsSync(viewerScenePath)) {
  copyTargets.push({ src: viewerScenePath, dest: rendererDest });
}

const outputCopyTargets = [
  { src: viewerRendererPath, dest: rendererOutDir },
];

if (existsSync(viewerScenePath)) {
  outputCopyTargets.push({ src: viewerScenePath, dest: rendererOutDir });
}

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
      ...(outputCopyTargets.length > 0
        ? [
          copy({
            targets: outputCopyTargets,
            hook: 'writeBundle',
            copySync: true,
          }),
        ]
        : []),
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
