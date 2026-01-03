import { app, BrowserWindow, Menu, clipboard, dialog } from 'electron';
import { createServer, type Server } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

app.setName('CADViewer');

/**
 * Get CLI path based on app installation location.
 * app.getAppPath() returns Resources/app.asar, so ../cad-cli accesses same directory.
 * Works for both per-user and per-machine installs.
 */
function getCliPath(): string {
  const appPath = app.getAppPath();
  if (process.platform === 'darwin') {
    return join(appPath, '../cad-cli.sh');
  }
  return join(appPath, '../cad-cli.cmd');
}

/**
 * Copy Claude Code setup snippet to clipboard.
 * Minimal snippet: CLI path + --help reference.
 */
function copyClaudeSetup(): void {
  const cliPath = getCliPath();
  const snippet = `## CADViewer
CLI: ${cliPath}
\`--help\`로 사용법 확인`;
  clipboard.writeText(snippet);

  dialog.showMessageBox({
    type: 'info',
    title: 'Claude Code Setup',
    message: 'CLAUDE.md 스니펫이 클립보드에 복사되었습니다.',
    detail: '프로젝트의 CLAUDE.md 파일에 붙여넣기 하세요.',
    buttons: ['확인'],
  });
}

/**
 * Create custom application menu.
 * Removes unused default items, adds "Setup Claude Code" in Help menu.
 */
function createAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Setup Claude Code',
          click: copyClaudeSetup,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

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

function resolveScenePath(): string {
  if (process.env.CAD_SCENE_PATH) {
    return process.env.CAD_SCENE_PATH;
  }
  const devScenePath = join(__dirname, '../../../viewer/scene.json');
  if (process.env.ELECTRON_RENDERER_URL && existsSync(devScenePath)) {
    return devScenePath;
  }
  return join(app.getPath('userData'), 'scene.json');
}

// App lifecycle
app.whenReady().then(async () => {
  createAppMenu();

  const scenePath = resolveScenePath();

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
    sceneServer.close((err) => {
      if (err) {
        console.error('Failed to close scene server:', err);
      }
    });
  }
});
