/**
 * Viewport Capture Tool
 *
 * Captures the CAD viewer as a PNG screenshot for Claude to analyze.
 * Platform behavior:
 * - Windows/Mac: Electron capture only (requires CADViewer app running)
 * - Linux: Puppeteer for web viewer (use forceMethod: 'puppeteer' on other platforms)
 */

import puppeteer from 'puppeteer';
import { promises as fs, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface CaptureOptions {
  url?: string;
  width?: number;
  height?: number;
  outputPath?: string;
  waitMs?: number;
  forceMethod?: 'electron' | 'puppeteer';
  /** Scene data to inject directly (bypasses WebSocket for Puppeteer capture) */
  sceneData?: unknown;
  /** Sketch data to inject directly (bypasses HTTP fetch for Puppeteer capture) */
  sketchData?: unknown;
}

// Path to sketch.json for reading sketch data
const SKETCH_FILE = join(homedir(), '.ai-native-cad', 'sketch.json');

/**
 * Read sketch data from ~/.ai-native-cad/sketch.json
 * Handles both { strokes: [...] } and [...] array formats
 */
async function readSketchData(): Promise<unknown | null> {
  try {
    const data = await fs.readFile(SKETCH_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both object format { strokes: [...] } and direct array format [...]
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return parsed.strokes || [];
  } catch (error) {
    // Silently ignore ENOENT (file not found) - expected when no sketch exists
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Log other errors for debugging (corrupt file, parse error, etc.)
    logger.warn('Failed to read sketch data', { file: SKETCH_FILE, error: String(error) });
    return null;
  }
}

export interface CaptureResult {
  success: boolean;
  path?: string;
  error?: string;
  method?: 'electron' | 'puppeteer';
}

/**
 * Type guard to validate CaptureResult from JSON response
 */
function isCaptureResult(obj: unknown): obj is CaptureResult {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return (
    typeof candidate.success === 'boolean' &&
    (candidate.path === undefined || typeof candidate.path === 'string') &&
    (candidate.error === undefined || typeof candidate.error === 'string')
  );
}

/**
 * Get the default userData path for Electron (platform-specific)
 */
function getElectronUserDataPath(): string {
  const appName = 'CADViewer';
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    return join(appData, appName);
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdgConfig, appName);
}

/**
 * Try to capture from Electron's data server
 * Returns null if Electron is not running
 */
async function tryElectronCapture(outputPath: string): Promise<CaptureResult | null> {
  // Electron's data server writes port to a file or we can try common ports
  // For now, try to read from a known port file or scan
  const userDataPath = getElectronUserDataPath();
  const portFilePath = join(userDataPath, '.server-port');

  try {
    // First try to read the port from file (if Electron writes it)
    let port: number | undefined;
    try {
      const portData = await fs.readFile(portFilePath, 'utf-8');
      const parsed = parseInt(portData.trim(), 10);
      // Validate parsed port (parseInt can return NaN for invalid input)
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
        port = parsed;
      }
    } catch (err) {
      // Port file doesn't exist - Electron app may not be running
      logger.debug('Electron port file not found', { path: portFilePath, error: String(err) });
    }

    // If we have a valid port, try the capture endpoint
    if (port) {
      const url = `http://127.0.0.1:${port}/capture?path=${encodeURIComponent(outputPath)}`;
      logger.debug('Electron capture request', { url, outputPath });
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      let result: unknown;
      try {
        result = await response.json();
      } catch (jsonError) {
        logger.debug('Electron capture returned invalid JSON', { error: String(jsonError) });
        return null;
      }
      if (!isCaptureResult(result)) {
        logger.debug('Electron capture returned invalid response', { result });
        return null;
      }
      logger.debug('Electron capture response', { status: response.status, result });
      if (response.ok && result.success) {
        return { ...result, method: 'electron' };
      }
      // Return the error from Electron
      return { ...result, method: 'electron' };
    }

    logger.debug('No port found for Electron capture');
    return null;
  } catch (err) {
    logger.debug('Electron capture failed', { error: String(err) });
    return null;
  }
}

/**
 * Capture the viewer viewport as a PNG
 *
 * Captures the full viewport including:
 * - CAD shapes (scene.json entities)
 * - Sketch overlay (red freehand drawings)
 * - Selection indicators (blue dashed borders)
 * - Lock indicators (orange solid borders)
 * - Grid and rulers (if enabled)
 *
 * Platform behavior:
 * - Windows/Mac: Electron capture (requires CADViewer app running)
 * - Linux: Puppeteer for web viewer
 * - Use forceMethod: 'puppeteer' to force browser capture on any platform
 */
export async function captureViewport(options: CaptureOptions = {}): Promise<CaptureResult> {
  // Default output path: use Electron userData on Windows/Mac, viewer dir on Linux
  const defaultOutputPath = (process.platform === 'win32' || process.platform === 'darwin')
    ? join(getElectronUserDataPath(), 'capture.png')
    : resolve(__dirname, '../../viewer/capture.png');

  const {
    // Default to GitHub Pages for production use
    // Puppeteer uses --allow-running-insecure-content to allow HTTPS → WS localhost
    url = process.env.CAD_VIEWER_URL || 'https://parktube.github.io/7-division/',
    width = 2400,
    height = 1500,
    outputPath = defaultOutputPath,
    waitMs = 2000,  // Wait for sketch to load
    forceMethod,
  } = options;

  // Check if Puppeteer is preferred via environment variable
  const preferPuppeteer = process.env.CAD_CAPTURE_METHOD === 'puppeteer';

  // On Windows/Mac, try Electron capture first (unless Puppeteer is preferred)
  if (!preferPuppeteer && forceMethod !== 'puppeteer' && (process.platform === 'win32' || process.platform === 'darwin')) {
    logger.debug('Trying Electron capture');
    const electronResult = await tryElectronCapture(outputPath);
    if (electronResult?.success) {
      logger.debug('Electron capture succeeded');
      return electronResult;
    }
    // Fall back to Puppeteer if Electron is not running
    logger.debug('Electron not available, falling back to Puppeteer');
  }

  // Skip Puppeteer if forced to use Electron
  if (forceMethod === 'electron') {
    return {
      success: false,
      error: 'Electron capture not available (is the Electron app running?)',
      method: 'electron',
    };
  }

  let browser;
  try {
    logger.debug('Starting viewport capture', { url, width, height, outputPath });

    // Ensure output directory exists (async to avoid blocking event loop)
    const outputDir = dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Launch headless browser (Puppeteer v22+ uses new headless mode by default)
    logger.debug('Launching headless browser');
    // Security: --no-sandbox only for local URLs or CI environments
    // For remote URLs, use sandboxed mode for security
    const isLocalUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/.test(url);
    const isHttps = /^https:\/\//.test(url);
    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    const baseArgs = [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      // Disable Service Worker to avoid "InvalidStateError: Failed to register a ServiceWorker"
      // Service Workers are not needed for capture-only headless sessions
      '--disable-features=ServiceWorker',
    ];
    // Security: --no-sandbox is required for Docker/CI but reduces security.
    // Only enable for local URLs or CI environments where the content is trusted.
    const sandboxArgs = (isLocalUrl || isCI)
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : [];
    // Mixed content handling: When HTTPS page (e.g., GitHub Pages) needs to connect
    // to ws://localhost MCP server, browsers block this by default as "mixed content".
    // These flags allow the connection for local development/capture purposes.
    // Note: This is safe because we only connect to localhost, not arbitrary HTTP endpoints.
    // In production, the viewer should use wss:// or run on the same origin.
    const mixedContentArgs = isHttps
      ? ['--allow-running-insecure-content', '--allow-insecure-localhost']
      : [];

    // Try to find Chrome/Chromium executable
    // Priority: Puppeteer's bundled Chromium > System browsers
    const chromePaths = [
      // Windows - Chrome
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      // Windows - Edge (Chromium-based)
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      // Windows - Brave
      `${process.env.LOCALAPPDATA}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      // macOS
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      // Linux
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];

    // First try system browsers, then fall back to Puppeteer's bundled Chromium
    const systemBrowser = chromePaths.find(p => p && existsSync(p));

    // If no system browser found, Puppeteer will use its bundled Chromium (executablePath: undefined)
    // This is the most reliable cross-platform approach
    const executablePath = systemBrowser || undefined;

    if (!executablePath) {
      logger.debug('No system browser found, using Puppeteer bundled Chromium');
    } else {
      logger.debug('Using system browser', { path: executablePath });
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [...baseArgs, ...sandboxArgs, ...mixedContentArgs],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });

    // Capture browser console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate to viewer with increased timeout
    // Use networkidle0 to ensure React app is fully mounted before injection
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Set capture mode flag to prevent onboarding dialog from appearing
    await page.evaluate(() => {
      (window as unknown as { __captureMode: boolean }).__captureMode = true;
    });

    // If scene data is provided, inject it directly (bypass WebSocket)
    if (options.sceneData) {
      logger.debug('Injecting scene data directly');

      // Retry injection with polling (React may not be mounted yet)
      let injected = false;
      const maxRetries = 5;
      for (let i = 0; i < maxRetries && !injected; i++) {
        if (i > 0) {
          await new Promise(done => setTimeout(done, 500));
        }
        const injectResult = await page.evaluate((sceneJson) => {
          type WindowWithInject = Window & {
            __injectScene?: (scene: unknown) => void;
            __getConnectionState?: () => string;
          };
          const win = window as WindowWithInject;
          const stateBefore = win.__getConnectionState?.() || 'no-func';
          if (win.__injectScene) {
            // sceneJson이 문자열이면 파싱 (exportScene()은 string 반환)
            const scene = typeof sceneJson === 'string' ? JSON.parse(sceneJson) : sceneJson;
            win.__injectScene(scene);
            const stateAfter = win.__getConnectionState?.() || 'no-func';
            return {
              injected: true,
              stateBefore,
              stateAfter
            };
          }
          return { injected: false, stateBefore, stateAfter: 'n/a' };
        }, options.sceneData);
        injected = injectResult.injected;
        logger.debug('Scene injection result', injectResult);
      }

      if (injected) {
        // Wait a bit for React to process the connectionState change
        await new Promise(done => setTimeout(done, 200));

        // Force hide any onboarding overlay (in case React re-render is slow)
        await page.evaluate(() => {
          // Hide onboarding modal overlay if it exists
          const overlay = document.querySelector('.fixed.inset-0.z-40') as HTMLElement;
          if (overlay) {
            overlay.style.display = 'none';
          }
        });

        // Wait for Canvas component to mount and render with frame stability check
        let canvasStable = false;
        const maxWaitTime = waitMs;
        const checkInterval = 200;
        let elapsed = 0;
        let lastPixelHash = '';

        while (elapsed < maxWaitTime && !canvasStable) {
          await new Promise(done => setTimeout(done, checkInterval));
          elapsed += checkInterval;

          const result = await page.evaluate(() => {
            try {
              const canvas = document.querySelector('#cad-canvas canvas') as HTMLCanvasElement;
              if (!canvas || canvas.width === 0 || canvas.height === 0) {
                return { ready: false, hash: '' };
              }
              // Sample 5 pixels for stability check (consistent with WebSocket path)
              const ctx = canvas.getContext('2d');
              if (!ctx) return { ready: false, hash: '' };
              const w = canvas.width;
              const h = canvas.height;
              const samples = [
                ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data,
                ctx.getImageData(Math.floor(w / 4), Math.floor(h / 4), 1, 1).data,
                ctx.getImageData(Math.floor(3 * w / 4), Math.floor(h / 4), 1, 1).data,
                ctx.getImageData(Math.floor(w / 4), Math.floor(3 * h / 4), 1, 1).data,
                ctx.getImageData(Math.floor(3 * w / 4), Math.floor(3 * h / 4), 1, 1).data,
              ];
              const hash = samples.map(d => `${d[0]},${d[1]},${d[2]}`).join('|');
              return { ready: true, hash };
            } catch {
              // SecurityError when canvas is tainted, treat as unstable frame
              return { ready: false, hash: '' };
            }
          });

          if (result.ready && result.hash === lastPixelHash && lastPixelHash !== '') {
            // Canvas is stable (same content for 2 consecutive checks)
            canvasStable = true;
          }
          lastPixelHash = result.hash;
        }

        if (!canvasStable) {
          logger.warn('Canvas not stable after injection, proceeding with capture anyway');
        }

        // Additional wait for any animations to settle
        await new Promise(done => setTimeout(done, 300));
      } else {
        // Injection failed - fall back to WebSocket scene loading
        logger.warn('__injectScene not available after retries, falling back to WebSocket loading');
        // Continue to WebSocket waiting logic below
      }
    }

    // Wait for WebSocket connection and scene to load (common path for both injection fallback and no-injection)
    // Use frame stability check to ensure rendering is complete
    let sceneStable = false;
    const maxWaitTime = waitMs;
    const checkInterval = 300;
    let elapsed = 0;
    let lastPixelHash = '';
    let stableCount = 0;
    const requiredStableChecks = 2; // Require 2 consecutive stable frames

    while (elapsed < maxWaitTime && !sceneStable) {
      await new Promise(done => setTimeout(done, checkInterval));
      elapsed += checkInterval;

      // Check if scene is loaded and stable
      const result = await page.evaluate(() => {
        try {
          const canvas = document.querySelector('#cad-canvas canvas') as HTMLCanvasElement;
          if (!canvas || canvas.width === 0 || canvas.height === 0) {
            return { loaded: false, hash: '', entityCount: 0 };
          }

          // Check WebSocket connection state from window
          type WindowWithWS = Window & { __wsConnectionState?: string; __sceneEntityCount?: number };
          const win = window as WindowWithWS;
          const entityCount = win.__sceneEntityCount ?? 0;

          // Sample pixels for stability check
          const ctx = canvas.getContext('2d');
          if (!ctx) return { loaded: false, hash: '', entityCount };

          const w = canvas.width;
          const h = canvas.height;
          const samples = [
            ctx.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data,
            ctx.getImageData(Math.floor(w / 4), Math.floor(h / 4), 1, 1).data,
            ctx.getImageData(Math.floor(3 * w / 4), Math.floor(h / 4), 1, 1).data,
            ctx.getImageData(Math.floor(w / 4), Math.floor(3 * h / 4), 1, 1).data,
            ctx.getImageData(Math.floor(3 * w / 4), Math.floor(3 * h / 4), 1, 1).data,
          ];
          const hash = samples.map(d => `${d[0]},${d[1]},${d[2]}`).join('|');

          // Check if content is not uniform background
          const first = samples[0];
          const tolerance = 5;
          const hasContent = !samples.every(d =>
            Math.abs(d[0] - first[0]) <= tolerance &&
            Math.abs(d[1] - first[1]) <= tolerance &&
            Math.abs(d[2] - first[2]) <= tolerance
          );

          return { loaded: hasContent || entityCount > 0, hash, entityCount };
        } catch {
          // SecurityError when canvas is tainted, treat as unstable frame
          return { loaded: false, hash: '', entityCount: 0 };
        }
      });

      if (result.loaded && result.hash === lastPixelHash && lastPixelHash !== '') {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          sceneStable = true;
        }
      } else {
        stableCount = 0; // Reset if content changed
      }
      lastPixelHash = result.hash;

      logger.debug('Scene stability check', { loaded: result.loaded, stable: sceneStable, entities: result.entityCount, elapsed });
    }

    if (!sceneStable) {
      logger.warn('Scene not stable after waiting, proceeding with capture anyway');
    }

    // Inject sketch data if provided or read from file (common for both paths)
    const sketchData = options.sketchData ?? await readSketchData();
    if (sketchData && Array.isArray(sketchData) && sketchData.length > 0) {
      logger.debug('Injecting sketch data', { strokeCount: sketchData.length });

      let sketchInjected = false;
      try {
        sketchInjected = await page.evaluate((strokes) => {
          type WindowWithSketch = Window & { __injectSketch?: (strokes: unknown) => void };
          const win = window as WindowWithSketch;
          if (win.__injectSketch) {
            win.__injectSketch(strokes);
            return true;
          }
          return false;
        }, sketchData);
      } catch (error) {
        logger.warn('__injectSketch failed, continuing without sketch', { error: String(error) });
        sketchInjected = false;
      }

      if (sketchInjected) {
        // Wait for sketch overlay to render
        await new Promise(done => setTimeout(done, 300));
      } else {
        logger.warn('__injectSketch not available - sketch will not be captured');
      }
    }

    // Log WebSocket status for debugging
    const wsStatus = await page.evaluate(() => {
      type WindowWithDebug = Window & {
        __wsConnectionState?: string;
        __sceneEntityCount?: number;
      };
      const win = window as WindowWithDebug;
      return {
        connectionState: win.__wsConnectionState || 'unknown',
        entityCount: win.__sceneEntityCount ?? -1,
      };
    });
    logger.debug('WebSocket status', wsStatus);
    logger.debug('Console logs from browser', { logs: consoleLogs.slice(-20) });

    // Set zoom level to 1x (default, no scaling)
    const zoomApplied = await page.evaluate(() => {
      // Use window.__setZoom if exposed by the viewer
      type WindowWithZoom = Window & { __setZoom?: (z: number) => void };
      const win = window as WindowWithZoom;
      if (win.__setZoom) {
        win.__setZoom(1);
        return true;
      }
      return false;
    });
    logger.debug('Zoom setting', { zoomApplied, targetZoom: 1 });
    await new Promise(done => setTimeout(done, 500)); // Wait for zoom to apply

    // Hide onboarding dialog right before capture (it appears after 1.5s delay)
    const hiddenOverlay = await page.evaluate(() => {
      // Find and hide any modal overlay (fixed position with z-40 class)
      // Try multiple selectors to be safe
      const selectors = [
        '.fixed.inset-0.z-40',
        '[class*="fixed"][class*="inset-0"][class*="z-40"]',
        '.fixed.inset-0.z-\\[40\\]',
      ];
      for (const selector of selectors) {
        try {
          const overlay = document.querySelector(selector) as HTMLElement;
          if (overlay) {
            overlay.style.display = 'none';
            return selector;
          }
        } catch { /* ignore invalid selector */ }
      }
      // Fallback: find by text content
      const allDivs = document.querySelectorAll('div');
      for (const div of allDivs) {
        if (div.textContent?.includes('MCP 서버') &&
            getComputedStyle(div).position === 'fixed') {
          (div as HTMLElement).style.display = 'none';
          return 'text-content-match';
        }
      }
      return null;
    });
    logger.debug('Onboarding overlay hidden', { selector: hiddenOverlay });

    // Find the canvas container element
    const canvasElement = await page.$('#cad-canvas');

    if (canvasElement) {
      // Capture only the canvas area
      await canvasElement.screenshot({ path: outputPath, type: 'png' });
    } else {
      // Fallback to full page if canvas not found
      logger.debug('Canvas element not found, capturing full page');
      await page.screenshot({ path: outputPath, type: 'png' });
    }

    logger.debug('Viewport capture completed successfully', { outputPath });

    return {
      success: true,
      path: outputPath,
      method: 'puppeteer',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Viewport capture failed', { error: errorMessage });

    // Provide helpful error message for common issues
    let helpMessage = errorMessage;
    if (errorMessage.includes('Could not find Chrome') || errorMessage.includes('No usable sandbox')) {
      helpMessage = `${errorMessage}\n\nTroubleshooting:\n` +
        '1. Install Chrome, Edge, or Brave browser\n' +
        '2. Or run: npx puppeteer browsers install chrome\n' +
        '3. On Windows, ensure browsers are in standard install paths';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('net::ERR')) {
      helpMessage = `${errorMessage}\n\nTroubleshooting:\n` +
        '1. Check if viewer is running (pnpm --filter @ai-native-cad/viewer dev)\n' +
        '2. Or use GitHub Pages viewer (default): set CAD_VIEWER_URL env var';
    }

    return {
      success: false,
      error: helpMessage,
      method: 'puppeteer',
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
