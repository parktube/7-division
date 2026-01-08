import { app, BrowserWindow } from 'electron';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve, sep } from 'path';
import { URL } from 'url';

app.setName('AI-Native CAD');

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

// Validate capture path is within allowed directories (path traversal prevention)
function isAllowedCapturePath(requestedPath: string): boolean {
  // resolve() converts to absolute path, preventing ../../../ attacks
  const resolved = resolve(requestedPath);
  // Allow: userData (Roaming) or app resources directory (Local/Programs/.../resources)
  const userData = resolve(app.getPath('userData'));
  const resourcesPath = resolve(app.getAppPath(), '..'); // app.asar -> resources folder

  // Check with path separator to prevent /app/data matching /app/data-evil
  const isInUserData = resolved === userData || resolved.startsWith(userData + sep);
  const isInResources = resolved === resourcesPath || resolved.startsWith(resourcesPath + sep);
  return isInUserData || isInResources;
}

// Capture the viewport as PNG
async function captureViewport(outputPath?: string): Promise<{ success: boolean; path?: string; error?: string }> {
  if (!mainWindow) {
    return { success: false, error: 'No window available' };
  }

  // Default output path in userData
  const capturePath = outputPath || join(app.getPath('userData'), 'capture.png');

  // Validate path (prevent directory traversal attacks)
  if (outputPath && !isAllowedCapturePath(capturePath)) {
    return { success: false, error: 'Invalid capture path: must be within userData directory' };
  }

  try {
    const image = await mainWindow.webContents.capturePage();
    const pngBuffer = image.toPNG();
    writeFileSync(capturePath, pngBuffer);

    return { success: true, path: capturePath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

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
    const chunks: Buffer[] = [];
    let bodySize = 0;
    let aborted = false;

    req.on('error', (err) => {
      if (aborted || res.writableEnded) return;
      aborted = true;
      res.statusCode = 500;
      res.end(`Request error: ${err.message}`);
    });

    req.on('data', (chunk: Buffer) => {
      if (aborted) return; // Ignore further data after limit exceeded
      bodySize += chunk.length;
      if (bodySize > MAX_BODY_SIZE) {
        aborted = true;
        // Send response first, then destroy request
        res.statusCode = 413;
        res.end('Payload too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted || res.writableEnded) return;
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
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

      const reqUrl = req.url || '';
      const parsedUrl = new URL(reqUrl, 'http://localhost');
      const pathname = parsedUrl.pathname;

      if (pathname === '/scene.json') {
        handleJsonFile(join(viewerPath, 'scene.json'), req, res);
      } else if (pathname === '/selection.json') {
        handleJsonFile(join(viewerPath, 'selection.json'), req, res);
      } else if (pathname === '/sketch.json') {
        handleJsonFile(join(viewerPath, 'sketch.json'), req, res);
      } else if (pathname === '/capture') {
        // Capture viewport as PNG
        const outputPath = parsedUrl.searchParams.get('path') || undefined;
        captureViewport(outputPath).then(result => {
          res.statusCode = result.success ? 200 : 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        }).catch(err => {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: String(err) }));
        });
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address !== 'string') {
        dataServer = server;
        // Write port to file for CLI discovery
        const portFilePath = join(viewerPath, '.server-port');
        writeFileSync(portFilePath, String(address.port));
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
  // Clean up port file
  const viewerPath = resolveViewerPath();
  const portFilePath = join(viewerPath, '.server-port');
  try {
    if (existsSync(portFilePath)) {
      unlinkSync(portFilePath);
    }
  } catch {
    // Ignore cleanup errors
  }

  if (dataServer) {
    dataServer.close((err) => {
      if (err) {
        // Electron main process: console.error logs to stderr (appropriate for error reporting)
        console.error('Failed to close data server:', err);
      }
    });
  }
});
