/**
 * Viewport Capture Tool
 *
 * Captures the CAD viewer as a PNG screenshot for Claude to analyze.
 * Platform behavior:
 * - Windows/Mac: Electron capture only (requires CADViewer app running)
 * - Linux: Puppeteer for web viewer (use forceMethod: 'puppeteer' on other platforms)
 */

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
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
 */
async function readSketchData(): Promise<unknown | null> {
  try {
    const data = await fs.readFile(SKETCH_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.strokes || [];
  } catch {
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

  // On Windows/Mac, use Electron capture (unless forced to use Puppeteer)
  if (forceMethod !== 'puppeteer' && (process.platform === 'win32' || process.platform === 'darwin')) {
    logger.debug('Trying Electron capture');
    const electronResult = await tryElectronCapture(outputPath);
    if (electronResult?.success) {
      logger.debug('Electron capture succeeded');
      return electronResult;
    }
    // Don't fall back to Puppeteer - Electron is the expected method on Windows/Mac
    const portFile = join(getElectronUserDataPath(), '.server-port');
    return {
      success: false,
      error: `Electron capture failed. Is the CADViewer app running? (Check ${portFile})`,
      method: 'electron',
    };
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
    const baseArgs = ['--disable-dev-shm-usage', '--disable-gpu'];
    const sandboxArgs = (isLocalUrl || isCI)
      ? ['--no-sandbox', '--disable-setuid-sandbox']
      : [];
    // Mixed content args only when HTTPS page needs to connect to ws://localhost
    const mixedContentArgs = isHttps
      ? ['--allow-running-insecure-content', '--allow-insecure-localhost']
      : [];

    browser = await puppeteer.launch({
      headless: true,
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
        injected = await page.evaluate((sceneJson) => {
          type WindowWithInject = Window & { __injectScene?: (scene: unknown) => void };
          const win = window as WindowWithInject;
          if (win.__injectScene) {
            // sceneJson이 문자열이면 파싱 (exportScene()은 string 반환)
            const scene = typeof sceneJson === 'string' ? JSON.parse(sceneJson) : sceneJson;
            win.__injectScene(scene);
            return true;
          }
          return false;
        }, options.sceneData);
      }

      if (injected) {
        // Wait for Canvas component to mount and render
        let canvasReady = false;
        const maxWaitTime = waitMs;
        const checkInterval = 200;
        let elapsed = 0;

        while (elapsed < maxWaitTime && !canvasReady) {
          await new Promise(done => setTimeout(done, checkInterval));
          elapsed += checkInterval;

          canvasReady = await page.evaluate(() => {
            const canvas = document.querySelector('#cad-canvas canvas') as HTMLCanvasElement;
            if (!canvas) return false;
            // Check if canvas has non-zero dimensions
            return canvas.width > 0 && canvas.height > 0;
          });
        }

        if (!canvasReady) {
          logger.warn('Canvas not ready after injection, proceeding with capture anyway');
        }

        // Inject sketch data if provided or read from file
        const sketchData = options.sketchData ?? await readSketchData();
        if (sketchData && Array.isArray(sketchData) && sketchData.length > 0) {
          logger.debug('Injecting sketch data', { strokeCount: sketchData.length });

          const sketchInjected = await page.evaluate((strokes) => {
            type WindowWithSketch = Window & { __injectSketch?: (strokes: unknown) => void };
            const win = window as WindowWithSketch;
            if (win.__injectSketch) {
              win.__injectSketch(strokes);
              return true;
            }
            return false;
          }, sketchData);

          if (sketchInjected) {
            // Wait for sketch overlay to render
            await new Promise(done => setTimeout(done, 300));
          } else {
            logger.warn('__injectSketch not available - sketch will not be captured');
          }
        }

        // Additional wait for render to complete
        await new Promise(done => setTimeout(done, 500));
      } else {
        // Injection failed - abort capture to avoid empty/misleading screenshots
        logger.error('__injectScene not available after retries - aborting capture');
        throw new Error('Scene injection failed: __injectScene not available in viewer');
      }
    } else {
      // Wait for WebSocket connection and scene to load
      // Instead of fixed timeout, wait for scene to have entities
      let sceneLoaded = false;
      const maxWaitTime = waitMs;
      const checkInterval = 500;
      let elapsed = 0;

      while (elapsed < maxWaitTime && !sceneLoaded) {
        await new Promise(done => setTimeout(done, checkInterval));
        elapsed += checkInterval;

        // Check if scene has entities
        sceneLoaded = await page.evaluate(() => {
          // Check if there are any rendered entities in the canvas
          const canvas = document.querySelector('#cad-canvas canvas') as HTMLCanvasElement;
          if (!canvas) return false;

          // Check WebSocket connection state from window
          type WindowWithWS = Window & { __wsConnectionState?: string; __sceneEntityCount?: number };
          const win = window as WindowWithWS;

          // If we have entity count exposed, use it
          if (typeof win.__sceneEntityCount === 'number') {
            return win.__sceneEntityCount > 0;
          }

          // Fallback: check if canvas has been drawn to (not just background)
          const ctx = canvas.getContext('2d');
          if (!ctx) return false;

          // Sample multiple pixels and check for variation (not uniform background)
          const w = canvas.width;
          const h = canvas.height;
          const samplePoints = [
            [w / 2, h / 2],
            [w / 4, h / 4],
            [3 * w / 4, h / 4],
            [w / 4, 3 * h / 4],
            [3 * w / 4, 3 * h / 4],
          ];

          const samples = samplePoints.map(([x, y]) => {
            const data = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
            return [data[0], data[1], data[2]];
          });

          // Check if all samples are the same (uniform background)
          const first = samples[0];
          const tolerance = 5;
          const allSame = samples.every(([r, g, b]) =>
            Math.abs(r - first[0]) <= tolerance &&
            Math.abs(g - first[1]) <= tolerance &&
            Math.abs(b - first[2]) <= tolerance
          );

          // If not all same, something is drawn
          return !allSame;
        });

        logger.debug(`Scene load check: ${sceneLoaded}, elapsed: ${elapsed}ms`);
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

    return {
      success: false,
      error: errorMessage,
      method: 'puppeteer',
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
