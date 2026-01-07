import { app, BrowserWindow } from 'electron';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

app.setName('CADViewer');

let mainWindow: BrowserWindow | null = null;
let dataServer: Server | null = null;
let serverBaseUrl: string | null = null;

const DEFAULT_SCENE = JSON.stringify({
  name: 'cad-scene',
  entities: [],
  last_operation: null,
}, null, 2);

function createDefaultSelection(): string {
  return JSON.stringify({
    selected_entities: [],
    locked_entities: [],
    hidden_entities: [],
    timestamp: Date.now(),
  }, null, 2);
}

function resolveDefaultScene(): string {
  const packagedScene = join(__dirname, '../renderer/scene.json');
  if (existsSync(packagedScene)) {
    return readFileSync(packagedScene, 'utf-8');
  }
  return DEFAULT_SCENE;
}

function ensureDataFiles(viewerPath: string): void {
  mkdirSync(viewerPath, { recursive: true });
  const scenePath = join(viewerPath, 'scene.json');
  const selectionPath = join(viewerPath, 'selection.json');

  if (!existsSync(scenePath)) {
    writeFileSync(scenePath, resolveDefaultScene());
  }
  if (!existsSync(selectionPath)) {
    writeFileSync(selectionPath, createDefaultSelection());
  }
}

// Maximum body size for POST requests (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

function handleJsonFile(filePath: string, req: IncomingMessage, res: ServerResponse): void {
  if (req.method === 'GET') {
    try {
      const data = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '{}';
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
  } else if (req.method === 'POST') {
    let body = '';
    let bodySize = 0;
    req.on('data', (chunk: Buffer) => {
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        req.destroy();
        res.statusCode = 413;
        res.end('Payload too large');
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      try {
        JSON.parse(body); // Validate JSON
        writeFileSync(filePath, body, 'utf-8');
        res.statusCode = 200;
        res.end('OK');
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
      }
    });
  } else {
    res.statusCode = 405;
    res.end('Method not allowed');
  }
}

async function startDataServer(viewerPath: string): Promise<string> {
  ensureDataFiles(viewerPath);

  return await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = req.url || '';
      const pathname = url.split('?')[0];  // Remove query string for exact matching
      if (pathname === '/scene.json') {
        handleJsonFile(join(viewerPath, 'scene.json'), req, res);
      } else if (pathname === '/selection.json') {
        handleJsonFile(join(viewerPath, 'selection.json'), req, res);
      } else if (pathname === '/sketch.json') {
        handleJsonFile(join(viewerPath, 'sketch.json'), req, res);
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        dataServer = server;
        resolve(`http://127.0.0.1:${address.port}`);
        return;
      }
      reject(new Error('data server failed to bind'));
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

  // Development: load from vite dev server (viewer's npm run dev)
  // Production: load from viewer/dist (copied to out/renderer)
  if (process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL);
    if (serverBaseUrl) {
      url.searchParams.set('dataServer', serverBaseUrl);
    }
    mainWindow.loadURL(url.toString());
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      query: serverBaseUrl ? { dataServer: serverBaseUrl } : undefined,
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function resolveViewerPath(): string {
  // Development: use viewer/ directory
  const devViewerPath = join(__dirname, '../../../viewer');
  if (process.env.ELECTRON_RENDERER_URL && existsSync(devViewerPath)) {
    return devViewerPath;
  }
  // Production: use userData directly (CLI writes here too)
  return app.getPath('userData');
}

// App lifecycle
app.whenReady().then(async () => {
  const viewerPath = resolveViewerPath();

  serverBaseUrl = await startDataServer(viewerPath);
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
  if (dataServer) {
    dataServer.close((err) => {
      if (err) {
        // Electron main process: console.error logs to stderr (appropriate for error reporting)
        console.error('Failed to close data server:', err);
      }
    });
  }
});
