import { app, BrowserWindow } from 'electron';
import { createServer, type Server } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

app.setName('CADViewer');

let mainWindow: BrowserWindow | null = null;
let sceneServer: Server | null = null;
let sceneUrl: string | null = null;

const DEFAULT_SCENE = JSON.stringify({
  name: 'cad-scene',
  entities: [],
  last_operation: null,
}, null, 2);

function resolveDefaultScene(): string {
  const packagedScene = join(__dirname, '../renderer/scene.json');
  if (existsSync(packagedScene)) {
    return readFileSync(packagedScene, 'utf-8');
  }
  return DEFAULT_SCENE;
}

function ensureSceneFile(scenePath: string): void {
  mkdirSync(dirname(scenePath), { recursive: true });
  if (!existsSync(scenePath)) {
    writeFileSync(scenePath, resolveDefaultScene());
  }
}

async function startSceneServer(scenePath: string): Promise<string> {
  ensureSceneFile(scenePath);

  return await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      if (!req.url || !req.url.startsWith('/scene.json')) {
        res.statusCode = 404;
        res.end();
        return;
      }

      try {
        const data = readFileSync(scenePath, 'utf-8');
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

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        sceneServer = server;
        resolve(`http://127.0.0.1:${address.port}/scene.json`);
        return;
      }
      reject(new Error('scene server failed to bind'));
    });

    server.on('error', reject);
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Development: load from vite dev server
  // Production: load from built files
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (sceneUrl) {
      url.searchParams.set('scene', sceneUrl);
    }
    mainWindow.loadURL(url.toString());
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: sceneUrl ? { scene: sceneUrl } : undefined,
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  const devScenePath = join(__dirname, '../../../viewer/scene.json');
  const scenePath = process.env.CAD_SCENE_PATH
    ? process.env.CAD_SCENE_PATH
    : (process.env.ELECTRON_RENDERER_URL && existsSync(devScenePath))
      ? devScenePath
      : join(app.getPath('userData'), 'scene.json');

  sceneUrl = await startSceneServer(scenePath);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (sceneServer) {
    sceneServer.close();
  }
});
